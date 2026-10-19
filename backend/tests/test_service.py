import base64
import hashlib
import hmac
import json
import os
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

import sys
sys.path.insert(0, str(Path(__file__).parents[1]))
import main


class EncryptedOrderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.key = bytes(range(32))
        self.admin_token = 'ADMIN_TOKEN_32_CHARS_SECRET_FOR_TEST_ONLY'
        self.secret = 'SHOPIFY_WEBHOOK_SECRET_FOR_TEST'
        os.environ.update({
            'ALANTIS_SQL_KEY_B64': base64.b64encode(self.key).decode(),
            'ALANTIS_ADMIN_TOKEN': self.admin_token,
            'ALANTIS_SHOPIFY_WEBHOOK_SECRET': self.secret,
            'ALANTIS_ALLOWED_SHOP': 'psm7b6-qs.myshopify.com',
            'ALANTIS_DATA_DIR': self.temp.name,
        })
        main._store = None
        self.client = TestClient(main.app)
        self.order = {
            'id': 1001, 'name': '#1001', 'email': 'test@example.invalid',
            'total_price': '49.95', 'currency': 'EUR',
            'financial_status': 'paid', 'fulfillment_status': None,
            'created_at': '2026-10-19T12:00:00Z',
            'line_items': [{'id': 5001, 'title': 'Camiseta', 'quantity': 2, 'price': '24.975', 'sku': 'CAM-GOLD'}]
        }

    def tearDown(self):
        main._store = None
        self.temp.cleanup()

    def post(self, payload, eid='evt-1', topic='orders/create', good=True):
        body = json.dumps(payload).encode()
        sig = base64.b64encode(hmac.new(self.secret.encode(), body, hashlib.sha256).digest()).decode()
        headers = {'X-Shopify-Topic': topic, 'X-Shopify-Webhook-Id': eid,
                   'X-Shopify-Shop-Domain': 'psm7b6-qs.myshopify.com',
                   'X-Shopify-Hmac-Sha256': sig if good else 'wrong',
                   'Content-Type': 'application/json'}
        return self.client.post('/webhooks/shopify', content=body, headers=headers)

    def test_encrypted_persistent_order_and_replay(self):
        self.assertEqual(self.post(self.order).status_code, 200)
        encrypted = Path(self.temp.name, 'pedidos.sql.enc').read_bytes()
        self.assertTrue(encrypted.startswith(main.MAGIC))
        self.assertNotIn(b'test@example.invalid', encrypted)
        self.assertNotIn(b'CREATE TABLE', encrypted)
        self.assertNotEqual(encrypted[:16], b'SQLite format 3\0')
        response = self.post(self.order)
        self.assertTrue(response.json()['duplicate'])
        data = self.client.get('/api/admin/orders', headers={'Authorization': 'Bearer ' + self.admin_token})
        self.assertEqual(data.json()['orders'][0]['items'][0]['quantity'], 2)
        self.assertEqual(len(data.json()['orders']), 1)
        self.assertEqual(self.client.get('/api/admin/orders').status_code, 401)
        main._store = None
        saved = self.client.get('/api/admin/orders', headers={'Authorization': 'Bearer ' + self.admin_token})
        self.assertEqual(saved.json()['orders'][0]['email'], 'test@example.invalid')

    def test_order_update_and_wrong_decryption_key(self):
        self.assertEqual(self.post(self.order).status_code, 200)
        updated = dict(self.order, total_price='65.00', financial_status='refunded')
        self.assertEqual(self.post(updated, eid='evt-update', topic='orders/updated').status_code, 200)
        headers = {'Authorization': 'Bearer ' + self.admin_token}
        order = self.client.get('/api/admin/orders', headers=headers).json()['orders'][0]
        self.assertEqual(order['total'], '65.00')
        self.assertEqual(order['financial_status'], 'refunded')
        main._store = None
        os.environ['ALANTIS_SQL_KEY_B64'] = base64.b64encode(bytes([33] * 32)).decode()
        with self.assertRaises(Exception):
            main.db()

    def test_backup_integrity_and_shop_erasure(self):
        self.assertEqual(self.post(self.order).status_code, 200)
        path = Path(self.temp.name, 'pedidos.sql.enc')
        encrypted = path.read_bytes()
        corrupt = bytearray(encrypted)
        corrupt[-2] ^= 1
        path.write_bytes(corrupt)
        main._store = None
        with self.assertRaises(Exception):
            main.db()
        path.write_bytes(encrypted)
        self.assertEqual(self.post({'shop_id': 88}, eid='erase-shop', topic='shop/redact').status_code, 200)
        headers = {'Authorization': 'Bearer ' + self.admin_token}
        self.assertEqual(self.client.get('/api/admin/orders', headers=headers).json()['orders'], [])

    def test_bad_signature_and_redaction(self):
        self.assertEqual(self.post(self.order, good=False).status_code, 401)
        self.assertEqual(self.post(self.order).status_code, 200)
        redact = {'customer': {'id': 9}, 'orders_to_redact': [1001]}
        self.assertEqual(self.post(redact, eid='evt-2', topic='customers/redact').status_code, 200)
        remaining = self.client.get('/api/admin/orders', headers={'Authorization': 'Bearer ' + self.admin_token})
        self.assertEqual(remaining.json()['orders'], [])

    def test_admin_audit_and_backup(self):
        headers = {'Authorization': 'Bearer ' + self.admin_token}
        a = self.client.post('/api/admin/audit', headers=headers, json={'action': 'publicar_catalogo', 'target': 'products.json'})
        self.assertEqual(a.status_code, 200)
        self.assertEqual(self.client.get('/api/admin/logs', headers=headers).json()['logs'][0]['action'], 'publicar_catalogo')
        backup = self.client.get('/api/admin/backup', headers=headers)
        self.assertEqual(backup.status_code, 200)
        self.assertTrue(backup.content.startswith(main.MAGIC))


if __name__ == '__main__':
    unittest.main()