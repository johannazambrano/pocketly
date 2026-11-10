"""Test del server di sincronizzazione: python -m unittest discover -s server"""
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import unittest.mock
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import main  # noqa: E402
import webpush  # noqa: E402

KEY = 'k' * 40
PAYLOAD = {'format': 'pocketly-encrypted-backup', 'version': 1, 'kdf': 'PBKDF2-SHA256',
           'iterations': 600000, 'salt': 'c2FsdA==', 'iv': 'aXY=', 'data': 'ZGF0YQ=='}


class ServerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.tmp.name)
        self.server = main.make_server('127.0.0.1', 0, self.data_dir, KEY)
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}'
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def request(self, method, path, body=None, key=KEY, headers=None):
        data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        req = urllib.request.Request(self.url + path, data=data, method=method)
        if key:
            req.add_header('Authorization', f'Bearer {key}')
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req) as res:
                raw = res.read()
                return res.status, json.loads(raw) if raw else None, res.headers
        except urllib.error.HTTPError as e:
            raw = e.read()
            return e.code, json.loads(raw) if raw else None, e.headers

    def test_health_senza_chiave(self):
        status, body, _ = self.request('GET', '/api/health', key=None)
        self.assertEqual(status, 200)
        self.assertEqual(body, {'service': 'pocketly-sync', 'api': 1})

    def test_chiave_obbligatoria(self):
        self.assertEqual(self.request('GET', '/api/sync', key=None)[0], 401)
        self.assertEqual(self.request('GET', '/api/sync', key='sbagliata')[0], 401)
        self.assertEqual(self.request('PUT', '/api/sync', {'baseVersion': 0, 'payload': PAYLOAD}, key=None)[0], 401)

    def test_blocca_dopo_troppi_tentativi(self):
        for _ in range(main.MAX_FAILURES):
            self.request('GET', '/api/sync', key='sbagliata')
        self.assertEqual(self.request('GET', '/api/sync')[0], 429)

    def test_rifiuta_chiave_corta(self):
        with self.assertRaises(ValueError):
            main.make_server('127.0.0.1', 0, self.data_dir, 'corta')

    def test_server_vuoto(self):
        status, body, _ = self.request('GET', '/api/sync')
        self.assertEqual((status, body['version'], body['payload']), (200, 0, None))

    def test_salvataggio_con_versione(self):
        self.assertEqual(self.request('PUT', '/api/sync', {'baseVersion': 0, 'payload': PAYLOAD}), (200, {'version': 1}, unittest.mock.ANY))
        status, body, headers = self.request('GET', '/api/sync')
        self.assertEqual((status, body['version'], body['payload']), (200, 1, PAYLOAD))
        self.assertEqual(headers['ETag'], '"1"')
        self.assertEqual(self.request('GET', '/api/sync', headers={'If-None-Match': '"1"'})[0], 304)

    def test_conflitto_se_la_versione_non_e_l_ultima(self):
        self.request('PUT', '/api/sync', {'baseVersion': 0, 'payload': PAYLOAD})
        status, body, _ = self.request('PUT', '/api/sync', {'baseVersion': 0, 'payload': PAYLOAD})
        self.assertEqual((status, body), (409, {'version': 1}))

    def test_rifiuta_dati_non_cifrati(self):
        status, _, _ = self.request('PUT', '/api/sync', {'baseVersion': 0, 'payload': {'schemaVersion': 2}})
        self.assertEqual(status, 400)
        self.assertEqual(self.request('PUT', '/api/sync', b'non json')[0], 400)
        self.assertEqual(self.request('PUT', '/api/sync', {'baseVersion': True, 'payload': PAYLOAD})[0], 400)

    def test_conserva_le_versioni_precedenti(self):
        for v in range(main.HISTORY_KEEP + 3):
            self.request('PUT', '/api/sync', {'baseVersion': v, 'payload': {**PAYLOAD, 'iv': f'iv{v}'}})
        history = sorted(p.name for p in (self.data_dir / 'history').glob('*.json'))
        self.assertEqual(len(history), main.HISTORY_KEEP)
        self.assertEqual(history[-1], f'v{main.HISTORY_KEEP + 2:06d}.json')
        self.assertFalse(list(self.data_dir.glob('.tmp-*')))

    def test_percorsi_e_metodi_sconosciuti(self):
        self.assertEqual(self.request('GET', '/api/altro')[0], 404)
        self.assertEqual(self.request('POST', '/api/sync', {})[0], 405)


def make_fake_aes128gcm_payload() -> str:
    """Costruisce un pacchetto binario conforme all'intestazione RFC 8188 / RFC 8291 aes128gcm."""
    ephemeral = webpush.generate_vapid_keys()
    as_pub = webpush.b64url_decode(ephemeral['publicKey'])
    salt = os.urandom(16)
    rs = (4096).to_bytes(4, 'big')
    idlen = (65).to_bytes(1, 'big')
    ciphertext = os.urandom(32)
    return webpush.b64url_encode(salt + rs + idlen + as_pub + ciphertext)


class WebPushTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.tmp.name)
        self.sent_calls: list[tuple[str, str, dict]] = []
        self.next_status = 201

        def fake_sender(endpoint: str, payload_b64: str, vapid: dict, ttl: int = 86400) -> int:
            self.sent_calls.append((endpoint, payload_b64, vapid))
            return self.next_status

        self.server = main.make_server(
            '127.0.0.1', 0, self.data_dir, KEY, sender=fake_sender, start_dispatcher=False
        )
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}'
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

        client_keys = webpush.generate_vapid_keys()
        self.p256dh = client_keys['publicKey']
        self.auth = webpush.b64url_encode(os.urandom(16))
        self.enc_payload = make_fake_aes128gcm_payload()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def request(self, method, path, body=None, key=KEY):
        data = None if body is None else json.dumps(body).encode('utf-8')
        req = urllib.request.Request(self.url + path, data=data, method=method)
        if key:
            req.add_header('Authorization', f'Bearer {key}')
        if data is not None:
            req.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(req) as res:
                raw = res.read()
                return res.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read()
            return e.code, json.loads(raw) if raw else None

    def test_firma_e_verifica_vapid_es256_pura_stdlib(self):
        vapid = webpush.generate_vapid_keys()
        auth_header = webpush.create_vapid_auth_header(vapid, 'https://fcm.googleapis.com/fcm/send/abc')
        self.assertTrue(auth_header.startswith('vapid t='))
        jwt_part = auth_header.split('t=')[1].split(',')[0]
        h_b64, p_b64, s_b64 = jwt_part.split('.')
        signing_input = f'{h_b64}.{p_b64}'.encode('ascii')
        self.assertTrue(webpush.verify_es256(vapid['publicKey'], signing_input, webpush.b64url_decode(s_b64)))
        claims = json.loads(webpush.b64url_decode(p_b64))
        self.assertEqual(claims['aud'], 'https://fcm.googleapis.com')

    def test_registrazione_dispositivo_e_config(self):
        status, cfg = self.request('GET', '/api/push/config')
        self.assertEqual(status, 200)
        self.assertTrue(webpush.valid_p256dh(cfg['vapidPublicKey']))
        self.assertEqual(cfg['devices'], [])

        sub = {
            'deviceId': 'device-iphone-1',
            'endpoint': 'https://web.push.apple.com/Q12345',
            'p256dh': self.p256dh,
            'auth': self.auth,
        }
        self.assertEqual(self.request('PUT', '/api/push/subscription', sub)[0], 200)

        status, cfg2 = self.request('GET', '/api/push/config')
        self.assertEqual(len(cfg2['devices']), 1)
        self.assertEqual(cfg2['devices'][0]['deviceId'], 'device-iphone-1')
        self.assertEqual(cfg2['devices'][0]['p256dh'], self.p256dh)

        self.assertEqual(self.request('DELETE', '/api/push/subscription', {'deviceId': 'device-iphone-1'})[0], 200)
        self.assertEqual(self.request('GET', '/api/push/config')[1]['devices'], [])

    def test_rifiuta_schedule_in_chiaro_o_non_aes128gcm(self):
        sub = {
            'deviceId': 'device-12345678',
            'endpoint': 'https://fcm.googleapis.com/fcm/send/1',
            'p256dh': self.p256dh,
            'auth': self.auth,
        }
        self.request('PUT', '/api/push/subscription', sub)

        plaintext_b64 = webpush.b64url_encode(b'{"title":"Affitto","body":"500 euro"}')
        bad_item = {'id': 'rem-1', 'deviceId': 'device-12345678', 'fireAt': 1800000000, 'payload': plaintext_b64}
        status, _ = self.request('PUT', '/api/push/schedule', {'items': [bad_item]})
        self.assertEqual(status, 400)

    def test_invia_promemoria_scaduti_senza_duplicati_e_pulisce_410(self):
        sub = {
            'deviceId': 'device-12345678',
            'endpoint': 'https://fcm.googleapis.com/fcm/send/1',
            'p256dh': self.p256dh,
            'auth': self.auth,
        }
        self.request('PUT', '/api/push/subscription', sub)

        base_ts = int(time.time())
        items = [
            {'id': 'rem-1', 'deviceId': 'device-12345678', 'fireAt': base_ts + 1000, 'payload': self.enc_payload},
            {'id': 'rem-2', 'deviceId': 'device-12345678', 'fireAt': base_ts + 2000, 'payload': self.enc_payload},
        ]
        status, body = self.request('PUT', '/api/push/schedule', {'items': items})
        self.assertEqual((status, body), (200, {'scheduled': 2}))

        # A base_ts + 1500 scatta solo rem-1
        sent = self.server.push_store.dispatch_due(now_ts=base_ts + 1500)
        self.assertEqual(sent, 1)
        self.assertEqual(len(self.sent_calls), 1)

        # Ricaricando la stessa lista, rem-1 non viene riprogrammato perché già in `sent`
        status, body = self.request('PUT', '/api/push/schedule', {'items': items})
        self.assertEqual(body['scheduled'], 1)

        # Se l'endpoint risponde 410 Gone a base_ts + 2500, la sottoscrizione viene rimossa
        self.next_status = 410
        self.server.push_store.dispatch_due(now_ts=base_ts + 2500)
        self.assertEqual(self.request('GET', '/api/push/config')[1]['devices'], [])

    def test_invio_notifica_di_prova(self):
        sub = {
            'deviceId': 'device-12345678',
            'endpoint': 'https://fcm.googleapis.com/fcm/send/1',
            'p256dh': self.p256dh,
            'auth': self.auth,
        }
        self.request('PUT', '/api/push/subscription', sub)
        status, body = self.request('POST', '/api/push/test', {'deviceId': 'device-12345678', 'payload': self.enc_payload})
        self.assertEqual((status, body), (200, {'status': 201}))
        self.assertEqual(len(self.sent_calls), 1)

    def test_vapid_subject_configurabile(self):
        vapid = webpush.generate_vapid_keys()
        # Default subject non è localhost
        auth_default = webpush.create_vapid_auth_header(vapid, 'https://web.push.apple.com/endpoint')
        jwt_token = auth_default.split('t=')[1].split(',')[0]
        claims = json.loads(webpush.b64url_decode(jwt_token.split('.')[1]))
        self.assertEqual(claims['sub'], 'mailto:support@pocketly.local')

        # Con variabile d'ambiente POCKETLY_VAPID_SUBJECT
        with unittest.mock.patch.dict(os.environ, {'POCKETLY_VAPID_SUBJECT': 'https://pocketly.example.com'}):
            auth_custom = webpush.create_vapid_auth_header(vapid, 'https://web.push.apple.com/endpoint')
            jwt_token_custom = auth_custom.split('t=')[1].split(',')[0]
            claims_custom = json.loads(webpush.b64url_decode(jwt_token_custom.split('.')[1]))
            self.assertEqual(claims_custom['sub'], 'https://pocketly.example.com')

        # Se vuoto o spazi, fallback sicuro sul default
        with unittest.mock.patch.dict(os.environ, {'POCKETLY_VAPID_SUBJECT': '   '}):
            self.assertEqual(webpush.get_vapid_subject(), webpush.DEFAULT_VAPID_SUBJECT)

    def test_replace_schedule_conserva_pending_ultime_24h(self):
        sub = {
            'deviceId': 'device-12345678',
            'endpoint': 'https://fcm.googleapis.com/fcm/send/1',
            'p256dh': self.p256dh,
            'auth': self.auth,
        }
        self.request('PUT', '/api/push/subscription', sub)
        base_ts = int(time.time())

        # Inserisce un item dovuto da 5 minuti fa (in attesa di dispatch)
        old_item = {
            'id': 'rem-due-recently',
            'deviceId': 'device-12345678',
            'fireAt': base_ts - 300,
            'payload': self.enc_payload,
        }
        self.server.push_store.replace_schedule([old_item])

        # Ora arriva una nuova pianificazione con un item futuro (senza rem-due-recently)
        future_item = {
            'id': 'rem-future',
            'deviceId': 'device-12345678',
            'fireAt': base_ts + 3600,
            'payload': self.enc_payload,
        }
        self.request('PUT', '/api/push/schedule', {'items': [future_item]})

        # Verifica che il server conservi ancora rem-due-recently nello schedule
        with self.server.push_store.lock:
            data = self.server.push_store._ensure_initialized()
            sched_ids = [s['id'] for s in data['schedule']]
            self.assertIn('rem-due-recently', sched_ids)
            self.assertIn('rem-future', sched_ids)

    def test_push_json_corrotto_solleva_errore_senza_cancellare(self):
        # Scrive un push.json non valido
        push_file = self.data_dir / 'push.json'
        push_file.write_text('{ invalid json ...', encoding='utf-8')
        with self.assertRaises(RuntimeError):
            self.server.push_store._read_unlocked()
        # Assicura che il file non sia stato sovrascritto
        self.assertEqual(push_file.read_text(encoding='utf-8'), '{ invalid json ...')

    def test_mittente_vapid_riconosce_i_domini_non_pubblici(self):
        self.assertIsNotNone(webpush.vapid_subject_problem(webpush.DEFAULT_VAPID_SUBJECT))
        self.assertIsNotNone(webpush.vapid_subject_problem('mailto:pocketly@localhost'))
        self.assertIsNotNone(webpush.vapid_subject_problem('mailto:senza-chiocciola'))
        self.assertIsNotNone(webpush.vapid_subject_problem('pocketly@example.org'))
        self.assertIsNotNone(webpush.vapid_subject_problem('https://pocketly.lan'))
        self.assertIsNone(webpush.vapid_subject_problem('mailto:johanna@gmail.com'))
        self.assertIsNone(webpush.vapid_subject_problem('https://pocketly.example.org/'))

    def test_push_json_corrotto_non_ferma_la_sincronizzazione(self):
        # Un push.json rovinato all'avvio: il server parte, /api/sync funziona, le notifiche rispondono 503.
        self.server.shutdown()
        self.server.server_close()
        (self.data_dir / 'push.json').write_text('{ invalid json ...', encoding='utf-8')
        self.server = main.make_server('127.0.0.1', 0, self.data_dir, KEY, start_dispatcher=False)
        self.url = f'http://127.0.0.1:{self.server.server_address[1]}'
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

        self.assertEqual(self.request('PUT', '/api/sync', {'baseVersion': 0, 'payload': PAYLOAD})[0], 200)
        self.assertEqual(self.request('GET', '/api/sync')[0], 200)
        status, body = self.request('GET', '/api/push/config')
        self.assertEqual((status, body), (503, {'error': 'push unavailable'}))
        self.assertEqual(self.request('PUT', '/api/push/schedule', {'items': []})[0], 503)
        # Il file rovinato resta com'è, per poterlo recuperare a mano.
        self.assertEqual((self.data_dir / 'push.json').read_text(encoding='utf-8'), '{ invalid json ...')

    def test_push_json_vapid_incompleto_solleva_errore(self):
        push_file = self.data_dir / 'push.json'
        push_file.write_text('{"vapid": {}}', encoding='utf-8')
        with self.assertRaises(RuntimeError):
            self.server.push_store._read_unlocked()

    def test_replace_schedule_ordina_per_fireAt(self):
        sub = {
            'deviceId': 'device-12345678',
            'endpoint': 'https://fcm.googleapis.com/fcm/send/1',
            'p256dh': self.p256dh,
            'auth': self.auth,
        }
        self.request('PUT', '/api/push/subscription', sub)
        base_ts = int(time.time())

        # Item fuori ordine cronologico
        items = [
            {'id': 'rem-late', 'deviceId': 'device-12345678', 'fireAt': base_ts + 2000, 'payload': self.enc_payload},
            {'id': 'rem-early', 'deviceId': 'device-12345678', 'fireAt': base_ts + 100, 'payload': self.enc_payload},
        ]
        self.request('PUT', '/api/push/schedule', {'items': items})
        with self.server.push_store.lock:
            data = self.server.push_store._ensure_initialized()
            sched = data['schedule']
            self.assertEqual(sched[0]['id'], 'rem-early')
            self.assertEqual(sched[1]['id'], 'rem-late')

    def test_logging_warning_su_errori_push_gateway(self):
        sub = {
            'deviceId': 'device-12345678',
            'endpoint': 'https://fcm.googleapis.com/fcm/send/1',
            'p256dh': self.p256dh,
            'auth': self.auth,
        }
        self.request('PUT', '/api/push/subscription', sub)
        base_ts = int(time.time())

        items = [
            {'id': 'rem-403', 'deviceId': 'device-12345678', 'fireAt': base_ts - 10, 'payload': self.enc_payload},
        ]
        self.server.push_store.replace_schedule(items)

        # Risposta 403 con body
        self.next_status = webpush.PushResponse(403, 'BadJwtToken')
        with self.assertLogs('pocketly.server', level='WARNING') as cm:
            self.server.push_store.dispatch_due(now_ts=base_ts)
            self.assertTrue(any('403' in m and 'BadJwtToken' in m for m in cm.output))

        # Test anche per send_test con errore 500
        self.next_status = webpush.PushResponse(500, 'Internal Server Error')
        with self.assertLogs('pocketly.server', level='WARNING') as cm:
            self.server.push_store.send_test('device-12345678', self.enc_payload)
            self.assertTrue(any('500' in m for m in cm.output))


    def test_rifiuta_endpoint_verso_la_rete_locale(self):
        self.assertTrue(webpush.valid_endpoint('https://web.push.apple.com/Q1'))
        for bad in ('https://192.168.1.10/push', 'https://10.0.0.1/x', 'https://[::1]/x', 'https://localhost/x',
                    'https://router.lan/x', 'https://nas.local/x', 'https://intranet/x', 'ftp://web.push.apple.com/x'):
            self.assertFalse(webpush.valid_endpoint(bad), bad)

    def test_chiavi_nuove_tolgono_le_voci_cifrate_con_le_vecchie(self):
        sub = {'deviceId': 'device-12345678', 'endpoint': 'https://fcm.googleapis.com/fcm/send/1',
               'p256dh': self.p256dh, 'auth': self.auth}
        self.request('PUT', '/api/push/subscription', sub)
        future = int(time.time()) + 3600
        self.server.push_store.replace_schedule(
            [{'id': 'rem-1', 'deviceId': 'device-12345678', 'fireAt': future, 'payload': self.enc_payload}])
        # Stesse chiavi: il calendario resta.
        self.request('PUT', '/api/push/subscription', sub)
        self.assertEqual(len(self.server.push_store._read_unlocked()['schedule']), 1)
        # Chiavi nuove: le voci vecchie non sarebbero leggibili e vengono tolte.
        sub2 = dict(sub, p256dh=webpush.generate_vapid_keys()['publicKey'])
        self.request('PUT', '/api/push/subscription', sub2)
        self.assertEqual(self.server.push_store._read_unlocked()['schedule'], [])

    def test_errore_temporaneo_scritto_una_volta_sola(self):
        sub = {'deviceId': 'device-12345678', 'endpoint': 'https://fcm.googleapis.com/fcm/send/segreto',
               'p256dh': self.p256dh, 'auth': self.auth}
        self.request('PUT', '/api/push/subscription', sub)
        base_ts = int(time.time())
        self.server.push_store.replace_schedule(
            [{'id': 'rem-1', 'deviceId': 'device-12345678', 'fireAt': base_ts - 10, 'payload': self.enc_payload}])
        self.next_status = webpush.PushResponse(503, 'Unavailable')
        with self.assertLogs('pocketly.server', level='WARNING') as cm:
            self.server.push_store.dispatch_due(now_ts=base_ts)
            self.server.push_store.dispatch_due(now_ts=base_ts + 30)
        self.assertEqual(len(cm.output), 1)
        # Nel log c'è il servizio, non l'indirizzo completo del dispositivo.
        self.assertIn('fcm.googleapis.com', cm.output[0])
        self.assertNotIn('segreto', cm.output[0])


class StartupTest(unittest.TestCase):
    def test_avvio_avvisa_se_il_mittente_non_e_reale(self):
        class FakeServer:
            def serve_forever(self):
                raise KeyboardInterrupt

        env = {'POCKETLY_SYNC_KEY': KEY, 'POCKETLY_VAPID_SUBJECT': ''}
        with unittest.mock.patch.dict(os.environ, env),                 unittest.mock.patch.object(main, 'make_server', return_value=FakeServer()),                 unittest.mock.patch('sys.stderr') as err:
            self.assertEqual(main.main(), 0)
        written = ''.join(str(c.args[0]) for c in err.write.call_args_list)
        self.assertIn('POCKETLY_VAPID_SUBJECT', written)


if __name__ == '__main__':
    unittest.main()
