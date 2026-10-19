"""Unit tests that run without a real MySQL installation (mock only)."""
import base64
import hashlib
import hmac
import importlib.util
import os
import pathlib
import sys
import types
import unittest
from unittest.mock import patch

# In this development environment PyMySQL may not be installed; these crypto/API
# tests remain meaningful with a minimal import stub. Run live DB tests separately.
try:
    import pymysql
except ImportError:
    fake=types.ModuleType('pymysql')
    fake_cursors=types.ModuleType('pymysql.cursors')
    fake_cursors.DictCursor=object
    fake.cursors=fake_cursors
    sys.modules['pymysql.cursors']=fake_cursors
    fake.MySQLError=type('MySQLError',(Exception,),{})
    sys.modules['pymysql']=fake
    pymysql=fake

path=pathlib.Path(__file__).resolve().parents[1]/'main.py'
spec=importlib.util.spec_from_file_location('alantis_mysql_main',path)
main=importlib.util.module_from_spec(spec)
spec.loader.exec_module(main)

class CryptoTests(unittest.TestCase):
    def setUp(self):
        self.key=os.urandom(32)
    def test_customer_field_encrypted_round_trip(self):
        a=main.encrypted_field(self.key,'cliente@example.com','customer:email')
        b=main.encrypted_field(self.key,'cliente@example.com','customer:email')
        self.assertNotEqual(a,b)
        self.assertNotIn(b'cliente@example.com',a)
        self.assertEqual(main.decrypted_field(self.key,a,'customer:email'),'cliente@example.com')
        with self.assertRaises(Exception):
            main.decrypted_field(self.key,a,'order:email')
    def test_backup_authentication(self):
        sql=b'CREATE TABLE test (id INT);'
        blob=main.crypt_backup(self.key,sql)
        self.assertNotIn(sql,blob)
        self.assertEqual(main.decrypt_backup(self.key,blob),sql)
        with self.assertRaises(Exception):
            main.decrypt_backup(os.urandom(32),blob)
        damaged=bytearray(blob);damaged[-1]^=1
        with self.assertRaises(Exception):
            main.decrypt_backup(self.key,bytes(damaged))
    def test_money_validation(self):
        self.assertEqual(str(main.money('25.9')),'25.90')
        for invalid in ('nan','inf','bad'):
            with self.assertRaises(ValueError):main.money(invalid)
    def test_no_db_credentials_in_public_responses(self):
        self.assertFalse(main.app.openapi_url)
    def test_webhook_hmac_rejection(self):
        from fastapi.testclient import TestClient
        payload=b'{"id":123}'
        test_store=types.SimpleNamespace(webhook_secret='somelongsecret',health=lambda:True)
        with patch.object(main,'store',return_value=test_store):
            client=TestClient(main.app)
            res=client.post('/webhooks/shopify',content=payload,headers={
                'X-Shopify-Topic':'orders/create','X-Shopify-Webhook-Id':'evt-1',
                'X-Shopify-Shop-Domain':'psm7b6-qs.myshopify.com','X-Shopify-Hmac-Sha256':'fake'})
            self.assertEqual(res.status_code,401)

if __name__=='__main__':unittest.main()