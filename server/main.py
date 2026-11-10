#!/usr/bin/env python3
"""Server di sincronizzazione e notifiche Web Push di Pocketly.

Conserva una sola copia dei dati, cifrata dai dispositivi (il server non conosce la password e non
può leggerla), con un numero di versione. Non unisce niente: un dispositivo può salvare solo se conosce
l'ultima versione, altrimenti riceve 409 e deve prima scaricare e unire i dati più recenti.

Per le notifiche Web Push conserva i dispositivi sottoscritti e l'elenco dei promemoria già cifrati
secondo RFC 8291 (`aes128gcm`) per le chiavi pubbliche `p256dh` dei dispositivi: anche per le notifiche
nessun testo in chiaro finisce mai sul disco del server.

Endpoint (dietro nginx, sotto /api/):
  GET    /api/health             -> {"service": "pocketly-sync", "api": 1}           (senza chiave)
  GET    /api/sync               -> {"version": n, "payload": {...} | null}         (304 se If-None-Match = versione)
  PUT    /api/sync               <- {"baseVersion": n, "payload": {...}}
                                 -> 200 {"version": n + 1} oppure 409 {"version": attuale}
  GET    /api/push/config        -> {"vapidPublicKey": "...", "devices": [...]}
  PUT    /api/push/subscription  <- {"deviceId": "...", "endpoint": "...", "p256dh": "...", "auth": "..."}
  DELETE /api/push/subscription  <- {"deviceId": "..."}
  PUT    /api/push/schedule      <- {"items": [{"id": "...", "deviceId": "...", "fireAt": n, "payload": "..."}]}
  POST   /api/push/test          <- {"deviceId": "...", "payload": "..."}

Configurazione (variabili d'ambiente):
  POCKETLY_SYNC_KEY      chiave di accesso, obbligatoria (almeno 32 caratteri)
  POCKETLY_VAPID_SUBJECT contatto VAPID (default mailto:support@pocketly.local)
  POCKETLY_DATA_DIR      cartella dei dati (default /var/lib/pocketly)
  POCKETLY_HOST          indirizzo di ascolto (default 127.0.0.1: si arriva solo tramite nginx)
  POCKETLY_PORT          porta (default 8787)

Richiede solo la libreria standard di Python (3.9 o successivo).
"""
from __future__ import annotations

import hmac
import json
import logging
import os
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger('pocketly.server')

try:
    from server.webpush import (
        generate_vapid_keys,
        send_web_push,
        valid_aes128gcm_payload,
        valid_auth_secret,
        valid_endpoint,
        valid_p256dh,
    )
except ImportError:
    from webpush import (  # type: ignore[no-redef]
        generate_vapid_keys,
        send_web_push,
        valid_aes128gcm_payload,
        valid_auth_secret,
        valid_endpoint,
        valid_p256dh,
    )

API_VERSION = 1
MIN_KEY_LENGTH = 32
MAX_BODY_BYTES = 5 * 1024 * 1024
HISTORY_KEEP = 30
ENCRYPTED_FORMAT = 'pocketly-encrypted-backup'

MAX_PUSH_DEVICES = 16
MAX_PUSH_SCHEDULE = 5000
SENT_RETENTION_SECONDS = 30 * 24 * 3600
PUSH_RETRY_WINDOW_SECONDS = 24 * 3600
DISPATCH_INTERVAL_SECONDS = 30.0

# Dopo troppi tentativi con la chiave sbagliata da uno stesso indirizzo, si blocca per un po'.
MAX_FAILURES = 10
FAILURE_WINDOW_SECONDS = 15 * 60


def write_atomic(path: Path, content: dict) -> None:
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix='.tmp-', suffix='.json')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(content, f, ensure_ascii=False, separators=(',', ':'))
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass
        raise


class Store:
    """Dati e versione su disco. Ogni scrittura è atomica: file temporaneo e poi rinomina."""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.current = data_dir / 'current.json'
        self.history = data_dir / 'history'
        self.lock = threading.Lock()
        self.history.mkdir(parents=True, exist_ok=True)

    def read(self) -> dict:
        try:
            with open(self.current, encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return {'version': 0, 'updatedAt': None, 'payload': None}

    def save(self, base_version: int, payload: dict) -> tuple[bool, int]:
        """Salva se `base_version` è l'ultima. Restituisce (salvato, versione attuale)."""
        with self.lock:
            current = self.read()
            if base_version != current['version']:
                return False, current['version']
            if current['payload'] is not None:
                # La versione precedente resta come copia di sicurezza: è un backup cifrato,
                # ripristinabile dall'app con "Importa backup" e la password.
                write_atomic(self.history / f"v{current['version']:06d}.json", current['payload'])
                self._prune_history()
            new = {
                'version': current['version'] + 1,
                'updatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                'payload': payload,
            }
            write_atomic(self.current, new)
            return True, new['version']

    def _prune_history(self) -> None:
        old = sorted(self.history.glob('v*.json'))[:-HISTORY_KEEP]
        for p in old:
            p.unlink(missing_ok=True)


class PushDataError(RuntimeError):
    """`push.json` esiste ma non si può leggere: le notifiche restano ferme finché il file non viene sistemato."""


class PushStore:
    """Sottoscrizioni Web Push e pianificazione cifrata (`aes128gcm`) su disco."""

    def __init__(self, data_dir: Path, sender=send_web_push):
        self.data_dir = data_dir
        self.file = data_dir / 'push.json'
        self.lock = threading.Lock()
        self.sender = sender
        self.data_dir.mkdir(parents=True, exist_ok=True)
        # Un push.json rovinato ferma solo le notifiche: il server parte lo stesso, così sincronizzazione e backup
        # continuano a funzionare. Le rotte /api/push/* rispondono 503 finché il file non viene sistemato.
        try:
            with self.lock:
                self._ensure_initialized()
        except PushDataError as e:
            logger.error('Notifiche ferme, la sincronizzazione continua: %s', e)

    def _read_unlocked(self) -> dict:
        if not self.file.exists():
            data = {
                'vapid': generate_vapid_keys(),
                'devices': {},
                'schedule': [],
                'sent': {},
            }
            write_atomic(self.file, data)
            return data

        try:
            with open(self.file, encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            logger.error('push.json esiste ma non è leggibile o decodificabile: %s', e)
            raise PushDataError(f'push data file {self.file} is corrupted: {e}') from e

        vapid = data.get('vapid') if isinstance(data, dict) else None
        if (
            not isinstance(data, dict)
            or not isinstance(vapid, dict)
            or not isinstance(vapid.get('publicKey'), str)
            or not isinstance(vapid.get('d'), str)
        ):
            logger.error('push.json non contiene una struttura valida (manca vapid o chiavi incomplete)')
            raise PushDataError(f'push data file {self.file} has invalid structure')

        return data

    def _ensure_initialized(self) -> dict:
        return self._read_unlocked()

    def config(self) -> dict:
        with self.lock:
            data = self._ensure_initialized()
            devices = [
                {
                    'deviceId': dev['deviceId'],
                    'p256dh': dev['p256dh'],
                    'auth': dev['auth'],
                }
                for dev in data.get('devices', {}).values()
            ]
            return {
                'vapidPublicKey': data['vapid']['publicKey'],
                'devices': devices,
            }

    def upsert_subscription(self, device_id: str, endpoint: str, p256dh: str, auth: str) -> None:
        with self.lock:
            data = self._ensure_initialized()
            devices: dict = data.setdefault('devices', {})
            if device_id not in devices and len(devices) >= MAX_PUSH_DEVICES:
                # Rimuove il dispositivo meno recente se si supera il limite
                oldest = min(devices.values(), key=lambda d: d.get('updatedAt', ''))
                devices.pop(oldest['deviceId'], None)
            devices[device_id] = {
                'deviceId': device_id,
                'endpoint': endpoint,
                'p256dh': p256dh,
                'auth': auth,
                'updatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            }
            write_atomic(self.file, data)

    def remove_subscription(self, device_id: str) -> None:
        with self.lock:
            data = self._ensure_initialized()
            devices: dict = data.get('devices', {})
            devices.pop(device_id, None)
            data['schedule'] = [s for s in data.get('schedule', []) if s.get('deviceId') != device_id]
            write_atomic(self.file, data)

    def replace_schedule(self, items: list[dict]) -> int:
        now_ts = int(time.time())
        with self.lock:
            data = self._ensure_initialized()
            devices: dict = data.get('devices', {})
            sent: dict = data.setdefault('sent', {})
            # Ripulisce lo storico degli invii più vecchi di 30 giorni
            cutoff = now_ts - SENT_RETENTION_SECONDS
            data['sent'] = {k: ts for k, ts in sent.items() if isinstance(ts, int) and ts >= cutoff}
            sent = data['sent']

            seen: set[str] = set()
            valid_items: list[dict] = []
            for item in items[:MAX_PUSH_SCHEDULE]:
                rem_id = item['id']
                dev_id = item['deviceId']
                key = f'{rem_id}@{dev_id}'
                if dev_id not in devices or key in seen or key in sent:
                    continue
                seen.add(key)
                valid_items.append({
                    'id': rem_id,
                    'deviceId': dev_id,
                    'fireAt': item['fireAt'],
                    'payload': item['payload'],
                })

            # Conserva le voci dovute recentemente (ultime 24h) ancora in attesa di dispatch o in fase di retry
            existing_pending = [
                s
                for s in data.get('schedule', [])
                if s.get('deviceId') in devices
                and f"{s.get('id')}@{s.get('deviceId')}" not in sent
                and f"{s.get('id')}@{s.get('deviceId')}" not in seen
                and s.get('fireAt', 0) <= now_ts
                and now_ts - s.get('fireAt', 0) <= PUSH_RETRY_WINDOW_SECONDS
            ]

            combined = existing_pending + valid_items
            combined.sort(key=lambda s: s.get('fireAt', 0))
            data['schedule'] = combined[:MAX_PUSH_SCHEDULE]
            write_atomic(self.file, data)
            return len(valid_items)

    def send_test(self, device_id: str, payload: str) -> Optional[int]:
        with self.lock:
            data = self._ensure_initialized()
            dev = data.get('devices', {}).get(device_id)
            vapid = data['vapid']
        if not dev:
            return None
        try:
            status = self.sender(dev['endpoint'], payload, vapid, ttl=300)
        except Exception as e:
            logger.warning(
                'Invio notifica di prova fallito con eccezione per device %s (endpoint %s): %s',
                device_id,
                dev['endpoint'],
                e,
            )
            return PushResponse(0, str(e))
        status_code = int(status)
        if status_code < 200 or status_code >= 300:
            resp_body = getattr(status, 'body', '')
            logger.warning(
                'Invio notifica di prova fallito per device %s (endpoint %s): HTTP %d %s',
                device_id,
                dev['endpoint'],
                status_code,
                resp_body,
            )
        if status_code in (404, 410):
            self.remove_subscription(device_id)
        return status

    def dispatch_due(self, now_ts: Optional[int] = None) -> int:
        """Invia i promemoria scaduti (`fireAt <= now_ts`). Restituisce il numero di invii riusciti."""
        now = int(time.time()) if now_ts is None else now_ts
        with self.lock:
            data = self._ensure_initialized()
            vapid = data['vapid']
            devices: dict = dict(data.get('devices', {}))
            schedule: list[dict] = list(data.get('schedule', []))
            sent: dict = dict(data.get('sent', {}))

        due = [s for s in schedule if s.get('fireAt', 0) <= now]
        if not due:
            return 0

        expired_devices: set[str] = set()
        delivered_keys: set[str] = set()
        drop_keys: set[str] = set()
        delivered_count = 0

        for item in due:
            dev_id = item['deviceId']
            key = f"{item['id']}@{dev_id}"
            dev = devices.get(dev_id)
            if not dev or dev_id in expired_devices or key in sent:
                drop_keys.add(key)
                continue
            if now - int(item['fireAt']) > PUSH_RETRY_WINDOW_SECONDS:
                drop_keys.add(key)
                continue

            try:
                status = self.sender(dev['endpoint'], item['payload'], vapid)
            except Exception as e:
                logger.warning(
                    'Eccezione durante invio push gateway per %s (endpoint %s): %s',
                    key,
                    dev['endpoint'],
                    e,
                )
                status = PushResponse(0, str(e))
            status_code = int(status)
            if 200 <= status_code < 300:
                delivered_keys.add(key)
                delivered_count += 1
            elif status_code in (404, 410):
                resp_body = getattr(status, 'body', '')
                logger.warning(
                    'Push gateway ha risposto %d per %s (endpoint %s): rimuovo sottoscrizione. Risposta: %s',
                    status_code,
                    dev_id,
                    dev['endpoint'],
                    resp_body,
                )
                expired_devices.add(dev_id)
                drop_keys.add(key)
            elif 400 <= status_code < 500 and status_code != 429:
                resp_body = getattr(status, 'body', '')
                logger.warning(
                    'Push gateway ha rifiutato definitivamente il promemoria %s per %s: HTTP %d. Risposta: %s',
                    key,
                    dev_id,
                    status_code,
                    resp_body,
                )
                drop_keys.add(key)
            else:
                resp_body = getattr(status, 'body', '')
                logger.warning(
                    'Errore temporaneo push gateway per %s (endpoint %s): HTTP %d. Risposta: %s',
                    key,
                    dev['endpoint'],
                    status_code,
                    resp_body,
                )

        with self.lock:
            data = self._ensure_initialized()
            for dev_id in expired_devices:
                data.get('devices', {}).pop(dev_id, None)
            for key in delivered_keys:
                data.setdefault('sent', {})[key] = now
            remove_all = delivered_keys | drop_keys
            data['schedule'] = [
                s
                for s in data.get('schedule', [])
                if s.get('deviceId') not in expired_devices and f"{s['id']}@{s['deviceId']}" not in remove_all
            ]
            write_atomic(self.file, data)

        return delivered_count


class Failures:
    def __init__(self):
        self.lock = threading.Lock()
        self.by_ip: dict[str, list[float]] = {}

    def blocked(self, ip: str) -> bool:
        now = time.monotonic()
        with self.lock:
            recent = [t for t in self.by_ip.get(ip, []) if now - t < FAILURE_WINDOW_SECONDS]
            self.by_ip[ip] = recent
            return len(recent) >= MAX_FAILURES

    def add(self, ip: str) -> None:
        with self.lock:
            self.by_ip.setdefault(ip, []).append(time.monotonic())


def valid_payload(payload: object) -> bool:
    """Il server accetta solo dati cifrati: i dati in chiaro non devono mai finire sul disco del server."""
    return (
        isinstance(payload, dict)
        and payload.get('format') == ENCRYPTED_FORMAT
        and all(isinstance(payload.get(k), str) for k in ('salt', 'iv', 'data'))
        and isinstance(payload.get('iterations'), int)
    )


def valid_device_id(value: object) -> bool:
    return isinstance(value, str) and 8 <= len(value) <= 128


def valid_schedule_item(item: object) -> bool:
    return (
        isinstance(item, dict)
        and isinstance(item.get('id'), str)
        and 1 <= len(item['id']) <= 200
        and valid_device_id(item.get('deviceId'))
        and isinstance(item.get('fireAt'), int)
        and not isinstance(item.get('fireAt'), bool)
        and item['fireAt'] > 0
        and valid_aes128gcm_payload(item.get('payload'))
    )


def push_safe(method):
    """Se push.json è rovinato, le sole rotte delle notifiche rispondono 503 invece di far cadere la connessione."""

    def wrapper(self):
        try:
            method(self)
        except PushDataError as e:
            logger.error('Richiesta notifiche non servita: %s', e)
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {'error': 'push unavailable'})

    return wrapper


def make_handler(store: Store, push_store: PushStore, key: str, failures: Failures):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'pocketly-sync'
        sys_version = ''

        def log_message(self, fmt, *args):  # niente dati nei log, solo metodo, percorso ed esito
            sys.stderr.write('%s %s\n' % (self.client_ip(), fmt % args))

        def client_ip(self) -> str:
            # Il server ascolta solo in locale: l'indirizzo vero lo passa nginx.
            return self.headers.get('X-Real-IP') or self.client_address[0]

        def send_json(self, status: int, body: Optional[dict] = None, extra: Optional[dict] = None) -> None:
            raw = b'' if body is None else json.dumps(body, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Cache-Control', 'no-store')
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            if body is not None:
                self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            if raw:
                self.wfile.write(raw)

        def authorized(self) -> bool:
            ip = self.client_ip()
            if failures.blocked(ip):
                self.send_json(HTTPStatus.TOO_MANY_REQUESTS, {'error': 'too many attempts'})
                return False
            auth = self.headers.get('Authorization', '')
            given = auth[7:].strip() if auth.startswith('Bearer ') else ''
            if given and hmac.compare_digest(given.encode('utf-8'), key.encode('utf-8')):
                return True
            failures.add(ip)
            self.send_json(HTTPStatus.UNAUTHORIZED, {'error': 'invalid key'})
            return False

        def read_json_body(self) -> Optional[dict]:
            try:
                length = int(self.headers.get('Content-Length', ''))
            except ValueError:
                self.send_json(HTTPStatus.LENGTH_REQUIRED, {'error': 'length required'})
                return None
            if length <= 0 or length > MAX_BODY_BYTES:
                self.send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {'error': 'body too large'})
                return None
            try:
                body = json.loads(self.rfile.read(length).decode('utf-8'))
            except (ValueError, UnicodeDecodeError):
                self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'invalid json'})
                return None
            if not isinstance(body, dict):
                self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'invalid body'})
                return None
            return body

        def path_only(self) -> str:
            return self.path.split('?', 1)[0].rstrip('/')

        @push_safe
        def do_GET(self):
            path = self.path_only()
            if path == '/api/health':
                self.send_json(HTTPStatus.OK, {'service': 'pocketly-sync', 'api': API_VERSION})
            elif path == '/api/sync':
                if not self.authorized():
                    return
                current = store.read()
                etag = f'"{current["version"]}"'
                if self.headers.get('If-None-Match') == etag:
                    self.send_json(HTTPStatus.NOT_MODIFIED, None, {'ETag': etag})
                    return
                self.send_json(
                    HTTPStatus.OK,
                    {'version': current['version'], 'updatedAt': current['updatedAt'], 'payload': current['payload']},
                    {'ETag': etag},
                )
            elif path == '/api/push/config':
                if not self.authorized():
                    return
                self.send_json(HTTPStatus.OK, push_store.config())
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {'error': 'not found'})

        @push_safe
        def do_PUT(self):
            path = self.path_only()
            if path == '/api/sync':
                if not self.authorized():
                    return
                body = self.read_json_body()
                if body is None:
                    return
                base = body.get('baseVersion')
                payload = body.get('payload')
                if not isinstance(base, int) or isinstance(base, bool) or not valid_payload(payload):
                    self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'invalid body'})
                    return
                saved, version = store.save(base, payload)
                self.send_json(HTTPStatus.OK if saved else HTTPStatus.CONFLICT, {'version': version})
            elif path == '/api/push/subscription':
                if not self.authorized():
                    return
                body = self.read_json_body()
                if body is None:
                    return
                dev_id = body.get('deviceId')
                endpoint = body.get('endpoint')
                p256dh = body.get('p256dh')
                auth = body.get('auth')
                if (
                    not valid_device_id(dev_id)
                    or not valid_endpoint(endpoint)
                    or not valid_p256dh(p256dh)
                    or not valid_auth_secret(auth)
                ):
                    self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'invalid subscription'})
                    return
                push_store.upsert_subscription(dev_id, endpoint, p256dh, auth)
                self.send_json(HTTPStatus.OK, {'ok': True})
            elif path == '/api/push/schedule':
                if not self.authorized():
                    return
                body = self.read_json_body()
                if body is None:
                    return
                items = body.get('items')
                if not isinstance(items, list) or len(items) > MAX_PUSH_SCHEDULE or not all(valid_schedule_item(x) for x in items):
                    self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'invalid schedule'})
                    return
                scheduled = push_store.replace_schedule(items)
                self.send_json(HTTPStatus.OK, {'scheduled': scheduled})
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {'error': 'not found'})

        @push_safe
        def do_POST(self):
            path = self.path_only()
            if path == '/api/push/test':
                if not self.authorized():
                    return
                body = self.read_json_body()
                if body is None:
                    return
                dev_id = body.get('deviceId')
                payload = body.get('payload')
                if not valid_device_id(dev_id) or not valid_aes128gcm_payload(payload):
                    self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'invalid test payload'})
                    return
                status = push_store.send_test(dev_id, payload)
                if status is None:
                    self.send_json(HTTPStatus.NOT_FOUND, {'error': 'device not registered'})
                    return
                self.send_json(HTTPStatus.OK, {'status': status})
            elif path == '/api/sync':
                self.send_json(HTTPStatus.METHOD_NOT_ALLOWED, {'error': 'method not allowed'})
            else:
                self.send_json(HTTPStatus.NOT_FOUND, {'error': 'not found'})

        @push_safe
        def do_DELETE(self):
            path = self.path_only()
            if path == '/api/push/subscription':
                if not self.authorized():
                    return
                body = self.read_json_body()
                if body is None:
                    return
                dev_id = body.get('deviceId')
                if not valid_device_id(dev_id):
                    self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'invalid deviceId'})
                    return
                push_store.remove_subscription(dev_id)
                self.send_json(HTTPStatus.OK, {'ok': True})
            else:
                self.send_json(HTTPStatus.METHOD_NOT_ALLOWED, {'error': 'method not allowed'})

        do_PATCH = do_POST

    return Handler


class PocketlyHTTPServer(ThreadingHTTPServer):
    push_store: PushStore
    _stop_event: threading.Event

    def server_close(self) -> None:
        if hasattr(self, '_stop_event'):
            self._stop_event.set()
        super().server_close()


def make_server(
    host: str,
    port: int,
    data_dir: Path,
    key: str,
    sender=send_web_push,
    start_dispatcher: bool = True,
) -> PocketlyHTTPServer:
    if len(key) < MIN_KEY_LENGTH:
        raise ValueError(f'POCKETLY_SYNC_KEY deve avere almeno {MIN_KEY_LENGTH} caratteri')
    store = Store(data_dir)
    push_store = PushStore(data_dir, sender=sender)
    srv = PocketlyHTTPServer((host, port), make_handler(store, push_store, key, Failures()))
    srv.push_store = push_store
    srv._stop_event = threading.Event()

    if start_dispatcher:
        def _loop():
            while not srv._stop_event.wait(DISPATCH_INTERVAL_SECONDS):
                try:
                    push_store.dispatch_due()
                except Exception as e:
                    sys.stderr.write(f'push dispatcher error: {e}\n')

        t = threading.Thread(target=_loop, name='pocketly-push-dispatcher', daemon=True)
        t.start()

    return srv


def main() -> int:
    key = os.environ.get('POCKETLY_SYNC_KEY', '').strip()
    if not key:
        print('POCKETLY_SYNC_KEY non impostata: il server non parte senza chiave.', file=sys.stderr)
        return 2
    host = os.environ.get('POCKETLY_HOST', '127.0.0.1')
    port = int(os.environ.get('POCKETLY_PORT', '8787'))
    data_dir = Path(os.environ.get('POCKETLY_DATA_DIR', '/var/lib/pocketly'))
    try:
        server = make_server(host, port, data_dir, key)
    except ValueError as e:
        print(e, file=sys.stderr)
        return 2
    print(f'Pocketly sync in ascolto su {host}:{port}, dati in {data_dir}', file=sys.stderr)
    subject = webpush.get_vapid_subject()
    problem = webpush.vapid_subject_problem(subject)
    if problem:
        print(
            f'ATTENZIONE notifiche: mittente VAPID "{subject}": {problem}. '
            'Imposta POCKETLY_VAPID_SUBJECT=mailto:indirizzo-vero in /etc/pocketly/sync.env e riavvia il servizio.',
            file=sys.stderr,
        )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == '__main__':
    sys.exit(main())
