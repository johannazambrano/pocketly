"""Test del server di sincronizzazione: python -m unittest discover -s server"""
import json
import tempfile
import threading
import unittest
import unittest.mock
import urllib.error
import urllib.request
from pathlib import Path

import main

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


if __name__ == '__main__':
    unittest.main()
