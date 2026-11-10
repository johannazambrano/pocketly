"""Protocollo Web Push (VAPID RFC 8292 + validazione RFC 8291 aes128gcm) per Pocketly.

Implementato interamente con la libreria standard di Python 3.9+, senza dipendenze esterne.
Il server firma i token VAPID ES256 (curva NIST P-256) e inoltra ai gateway push (Apple APNs,
Google FCM, Mozilla Autopush) i pacchetti `aes128gcm` già cifrati dai dispositivi client.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

# Parametri standard NIST P-256 (secp256r1 / prime256v1)
P = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
A = P - 3
B = 0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B
GX = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296
GY = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5

Point = tuple[int, int] | None

MAX_ENCRYPTED_PAYLOAD_BYTES = 4096
MIN_ENCRYPTED_PAYLOAD_BYTES = 86 + 17  # 86B header RFC 8188 + almeno 1B record + 16B tag GCM


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('ascii').rstrip('=')


def b64url_decode(text: str) -> bytes:
    if not isinstance(text, str) or not text:
        raise ValueError('empty base64 string')
    normalized = text.replace('-', '+').replace('_', '/')
    pad = '=' * ((4 - len(normalized) % 4) % 4)
    return base64.b64decode(normalized + pad)


def is_on_curve(pt: Point) -> bool:
    if pt is None:
        return False
    x, y = pt
    if not (0 <= x < P and 0 <= y < P):
        return False
    return (y * y - (x * x * x + A * x + B)) % P == 0


def pt_add(p1: Point, p2: Point) -> Point:
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2:
        if (y1 + y2) % P == 0:
            return None
        m = (3 * x1 * x1 + A) * pow(2 * y1, -1, P) % P
    else:
        m = (y2 - y1) * pow(x2 - x1, -1, P) % P
    x3 = (m * m - x1 - x2) % P
    y3 = (m * (x1 - x3) - y1) % P
    return x3, y3


def pt_mul(k: int, pt: Point = (GX, GY)) -> Point:
    res: Point = None
    addend = pt
    while k > 0:
        if k & 1:
            res = pt_add(res, addend)
        addend = pt_add(addend, addend)
        k >>= 1
    return res


def decode_uncompressed_point(raw: bytes) -> Point:
    if len(raw) != 65 or raw[0] != 0x04:
        return None
    x = int.from_bytes(raw[1:33], 'big')
    y = int.from_bytes(raw[33:65], 'big')
    pt = (x, y)
    return pt if is_on_curve(pt) else None


def generate_vapid_keys() -> dict[str, str]:
    """Genera una coppia di chiavi VAPID ECDSA P-256."""
    d = secrets.randbelow(N - 1) + 1
    pub = pt_mul(d)
    assert pub is not None
    qx, qy = pub
    pub_bytes = b'\x04' + qx.to_bytes(32, 'big') + qy.to_bytes(32, 'big')
    return {
        'd': b64url_encode(d.to_bytes(32, 'big')),
        'publicKey': b64url_encode(pub_bytes),
    }


def _rfc6979_k(d: int, digest: bytes) -> int:
    """Nonce deterministico RFC 6979 §3.2 con HMAC-SHA256."""
    x = d.to_bytes(32, 'big')
    h1 = (int.from_bytes(digest, 'big') % N).to_bytes(32, 'big')
    v = b'\x01' * 32
    k = b'\x00' * 32
    k = hmac.new(k, v + b'\x00' + x + h1, hashlib.sha256).digest()
    v = hmac.new(k, v, hashlib.sha256).digest()
    k = hmac.new(k, v + b'\x01' + x + h1, hashlib.sha256).digest()
    v = hmac.new(k, v, hashlib.sha256).digest()
    while True:
        v = hmac.new(k, v, hashlib.sha256).digest()
        candidate = int.from_bytes(v, 'big')
        if 1 <= candidate < N:
            return candidate
        k = hmac.new(k, v + b'\x00', hashlib.sha256).digest()
        v = hmac.new(k, v, hashlib.sha256).digest()


def sign_es256(d_b64: str, signing_input: bytes) -> bytes:
    """Firma ES256 (ECDSA P-256 + SHA-256) in formato IEEE P1363 (r || s, 64 byte)."""
    d = int.from_bytes(b64url_decode(d_b64), 'big')
    digest = hashlib.sha256(signing_input).digest()
    z = int.from_bytes(digest, 'big')
    k = _rfc6979_k(d, digest)
    pt = pt_mul(k)
    assert pt is not None
    r = pt[0] % N
    s = pow(k, -1, N) * (z + r * d) % N
    return r.to_bytes(32, 'big') + s.to_bytes(32, 'big')


def verify_es256(pub_b64: str, signing_input: bytes, sig: bytes) -> bool:
    """Verifica una firma ES256 (64 byte r || s). Usata nei test."""
    if len(sig) != 64:
        return False
    q = decode_uncompressed_point(b64url_decode(pub_b64))
    if q is None:
        return False
    r = int.from_bytes(sig[:32], 'big')
    s = int.from_bytes(sig[32:], 'big')
    if not (1 <= r < N and 1 <= s < N):
        return False
    z = int.from_bytes(hashlib.sha256(signing_input).digest(), 'big')
    w = pow(s, -1, N)
    u1 = z * w % N
    u2 = r * w % N
    pt = pt_add(pt_mul(u1), pt_mul(u2, q))
    return pt is not None and (pt[0] % N) == r


def create_vapid_auth_header(
    vapid: dict[str, str],
    endpoint: str,
    subject: str = 'mailto:pocketly@localhost',
    exp_seconds: int = 43200,
) -> str:
    """Costruisce il valore dell'intestazione `Authorization: vapid t=..., k=...` (RFC 8292)."""
    parsed = urllib.parse.urlsplit(endpoint)
    audience = f'{parsed.scheme}://{parsed.netloc}'
    header_b64 = b64url_encode(json.dumps({'typ': 'JWT', 'alg': 'ES256'}, separators=(',', ':')).encode('utf-8'))
    claims_b64 = b64url_encode(
        json.dumps(
            {'aud': audience, 'exp': int(time.time()) + exp_seconds, 'sub': subject},
            separators=(',', ':'),
        ).encode('utf-8')
    )
    signing_input = f'{header_b64}.{claims_b64}'.encode('ascii')
    sig_b64 = b64url_encode(sign_es256(vapid['d'], signing_input))
    return f'vapid t={header_b64}.{claims_b64}.{sig_b64}, k={vapid["publicKey"]}'


def valid_p256dh(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return decode_uncompressed_point(b64url_decode(value)) is not None
    except Exception:
        return False


def valid_auth_secret(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return len(b64url_decode(value)) == 16
    except Exception:
        return False


def valid_endpoint(value: object) -> bool:
    if not isinstance(value, str) or len(value) > 2048:
        return False
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme == 'https' and bool(parsed.netloc):
        return True
    # In test locale si consente http su 127.0.0.1 / localhost
    return parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1', 'localhost')


def valid_aes128gcm_payload(value: object) -> bool:
    """Verifica che il payload sia un pacchetto cifrato RFC 8188 / RFC 8291 (`aes128gcm`).

    Controlla l'intestazione binaria:
      - 16 byte salt
      - 4 byte record size (>= 18)
      - 1 byte idlen == 65
      - 65 byte chiave pubblica effimera P-256 valida sulla curva (`0x04 || X || Y`)
      - almeno 17 byte di ciphertext + tag AES-GCM
    Impedisce che dati in chiaro o JSON non cifrati vengano salvati sul server.
    """
    if not isinstance(value, str):
        return False
    try:
        raw = b64url_decode(value)
    except Exception:
        return False
    if not (MIN_ENCRYPTED_PAYLOAD_BYTES <= len(raw) <= MAX_ENCRYPTED_PAYLOAD_BYTES):
        return False
    rs = int.from_bytes(raw[16:20], 'big')
    idlen = raw[20]
    if rs < 18 or idlen != 65:
        return False
    return decode_uncompressed_point(raw[21:86]) is not None


def send_web_push(
    endpoint: str,
    payload_b64: str,
    vapid: dict[str, str],
    ttl: int = 86400,
    timeout: float = 10.0,
) -> int:
    """Invia una notifica Web Push cifrata all'endpoint del dispositivo.

    Restituisce il codice di stato HTTP (es. 201 Created, 404/410 sottoscrizione rimossa, 0 errore di rete).
    """
    body = b64url_decode(payload_b64)
    headers = {
        'Authorization': create_vapid_auth_header(vapid, endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'TTL': str(ttl),
        'Urgency': 'high',
    }
    req = urllib.request.Request(endpoint, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return int(resp.status)
    except urllib.error.HTTPError as e:
        return int(e.code)
    except Exception:
        return 0
