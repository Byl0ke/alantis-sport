"""ALANTIS SPORT: secure Shopify webhook mirror backed by private MySQL.

This is a *new optional backend*. The previous SQLite implementation remains in
backend/main.py for rollback until a real MySQL server and Shopify subscription are verified.
Never point a public browser directly at MySQL or include credentials in GitHub Pages.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import io
import json
import os
import secrets
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import pymysql
from pymysql.cursors import DictCursor
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

MAGIC = b"ALANTIS-MYSQL-AES256GCM-v1\n"
MAX_BODY = 2 * 1024 * 1024
MAX_BACKUP = 20 * 1024 * 1024  # This synchronous export is for small stores only.
TOPICS = {
    "orders/create", "orders/updated", "orders/cancelled",
    "customers/create", "customers/update", "customers/delete",
    "products/create", "products/update", "products/delete",
    "inventory_levels/update", "customers/redact", "shop/redact",
}
TABLES = ["customers", "products", "product_variants", "inventory", "orders", "order_items", "sales", "webhook_receipts", "audit_events"]


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def txt(value: Any, limit: int = 250) -> str | None:
    return str(value)[:limit] if value is not None else None


def money(value: Any) -> Decimal:
    try:
        result = Decimal(str(value if value is not None else "0"))
        if not result.is_finite() or abs(result) > Decimal("999999999999.99"):
            raise ValueError("Importe no válido")
        return result.quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError):
        raise ValueError("Importe no válido") from None


def encrypted_field(key: bytes, text: Any, label: str) -> bytes | None:
    if text is None or text == "":
        return None
    nonce = os.urandom(12)
    return nonce + AESGCM(key).encrypt(nonce, str(text).encode("utf-8"), label.encode("utf-8"))


def decrypted_field(key: bytes, value: bytes | None, label: str) -> str | None:
    if value is None:
        return None
    if len(value) < 28:
        raise ValueError("Campo cifrado inválido")
    return AESGCM(key).decrypt(value[:12], value[12:], label.encode("utf-8")).decode("utf-8")


def crypt_backup(key: bytes, sql: bytes) -> bytes:
    nonce = os.urandom(12)
    return MAGIC + nonce + AESGCM(key).encrypt(nonce, sql, MAGIC)


def decrypt_backup(key: bytes, blob: bytes) -> bytes:
    if not blob.startswith(MAGIC) or len(blob) <= len(MAGIC) + 28:
        raise ValueError("Formato de copia SQL no válido")
    offset = len(MAGIC)
    return AESGCM(key).decrypt(blob[offset:offset + 12], blob[offset + 12:], MAGIC)


def setting(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError("Falta variable privada: " + name)
    return value


class MySQLStore:
    def __init__(self):
        self.database = setting("MYSQL_DATABASE")
        self.host = setting("MYSQL_HOST")
        self.user = setting("MYSQL_USER")
        self.password = setting("MYSQL_PASSWORD")
        self.key = base64.b64decode(setting("ALANTIS_SQL_KEY_B64"), validate=True)
        self.admin_token = setting("ALANTIS_ADMIN_TOKEN")
        self.webhook_secret = setting("ALANTIS_SHOPIFY_WEBHOOK_SECRET")
        if len(self.key) != 32 or len(self.admin_token) < 32 or len(self.webhook_secret) < 12:
            raise RuntimeError("Las claves configuradas son demasiado cortas")
        self.port = int(os.getenv("MYSQL_PORT", "3306"))
        self.ssl_mode = os.getenv("MYSQL_SSL_MODE", "required").lower()
        if self.ssl_mode not in {"required", "disabled"}:
            raise RuntimeError("MYSQL_SSL_MODE debe ser required o disabled")
        if self.ssl_mode == "disabled" and self.host not in {"mysql", "localhost", "127.0.0.1"}:
            raise RuntimeError("TLS obligatorio para MySQL remoto")
        self.ssl_ca = os.getenv("MYSQL_SSL_CA", "")
        if self.ssl_mode == "required" and not self.ssl_ca:
            raise RuntimeError("MYSQL_SSL_CA obligatorio para TLS remoto con verificación de identidad")
        self._init_schema()

    @contextmanager
    def connection(self):
        opts = dict(host=self.host, port=self.port, user=self.user,
                    password=self.password, database=self.database,
                    connect_timeout=8, read_timeout=15, write_timeout=15,
                    autocommit=False, charset="utf8mb4", cursorclass=DictCursor)
        if self.ssl_mode == "required":
            opts.update(ssl_ca=self.ssl_ca, ssl_verify_cert=True, ssl_verify_identity=True)
        conn = pymysql.connect(**opts)
        try:
            yield conn
        finally:
            conn.close()

    def _init_schema(self):
        schema = Path(__file__).with_name("schema.sql").read_text("utf-8")
        with self.connection() as conn:
            with conn.cursor() as cursor:
                for statement in schema.split(";"):
                    # Remove '--' SQL comments. The schema contains no semicolons in literals.
                    statement = "\n".join(line for line in statement.splitlines() if not line.lstrip().startswith("--")).strip()
                    if statement:
                        cursor.execute(statement)
            conn.commit()

    def health(self):
        with self.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 AS alive")
                return cursor.fetchone()["alive"] == 1

    def read(self, sql: str, args: tuple = ()):  # private caller only; no user-authored SQL
        with self.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, args)
                return cursor.fetchall()

    def change(self, fn):
        with self.connection() as conn:
            try:
                with conn.cursor() as cursor:
                    result = fn(cursor)
                conn.commit()
                return result
            except Exception:
                conn.rollback()
                raise

    def counts(self) -> dict:
        with self.connection() as conn:
            with conn.cursor() as cur:
                result = {}
                for field, table in [("orders", "orders"), ("webhooks", "webhook_receipts"),
                                     ("audit_events", "audit_events"), ("customers", "customers"),
                                     ("products", "products"), ("inventory", "inventory"), ("sales", "sales")]:
                    cur.execute("SELECT COUNT(*) AS n FROM `" + table + "`")  # hardcoded allowlist
                    result[field] = cur.fetchone()["n"]
                return result

    def list_orders(self, limit: int):
        rows = self.read("SELECT * FROM orders ORDER BY COALESCE(created_at,updated_at) DESC LIMIT %s", (limit,))
        for row in rows:
            row["email"] = decrypted_field(self.key, row.pop("email_encrypted"), "order:email")
            row["total"] = str(row["total"])
            row["items"] = self.read("SELECT line_id,product_id,variant_id,title,sku,quantity,price FROM order_items WHERE order_id=%s", (row["order_id"],))
            for item in row["items"]:
                if item["price"] is not None:
                    item["price"] = str(item["price"])
        return rows

    def list_customers(self, limit: int):
        rows = self.read("SELECT * FROM customers ORDER BY updated_at DESC LIMIT %s", (limit,))
        for row in rows:
            for field in ("email", "first_name", "last_name"):
                row[field] = decrypted_field(self.key, row.pop(field + "_encrypted"), "customer:" + field)
        return rows

    def list_sales(self, limit: int):
        rows = self.read("SELECT * FROM sales ORDER BY updated_at DESC LIMIT %s", (limit,))
        for row in rows:
            row["gross_total"] = str(row["gross_total"])
        return rows

    def list_products(self, limit: int):
        return self.read("SELECT * FROM products ORDER BY updated_at DESC LIMIT %s", (limit,))

    def list_inventory(self, limit: int):
        return self.read("SELECT * FROM inventory ORDER BY updated_at DESC LIMIT %s", (limit,))

    def list_events(self, limit: int):
        return self.read("SELECT created_at,actor,action,target,event_type FROM audit_events ORDER BY id DESC LIMIT %s", (limit,))

    def _upsert_customer(self, cur, payload):
        cid = txt(payload.get("id"), 64)
        if not cid:
            return
        values = [encrypted_field(self.key, txt(payload.get(f), maxsize), "customer:" + f)
                  for f, maxsize in [("email", 254), ("first_name", 120), ("last_name", 120)]]
        cur.execute("""INSERT INTO customers(customer_id,email_encrypted,first_name_encrypted,last_name_encrypted,created_at,updated_at)
            VALUES(%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE
            email_encrypted=COALESCE(VALUES(email_encrypted),email_encrypted),
            first_name_encrypted=COALESCE(VALUES(first_name_encrypted),first_name_encrypted),
            last_name_encrypted=COALESCE(VALUES(last_name_encrypted),last_name_encrypted),
            updated_at=VALUES(updated_at)""",
            (cid, *values, txt(payload.get("created_at"), 45), txt(payload.get("updated_at"), 45) or utcnow()))

    def accept_webhook(self, topic: str, webhook_id: str, payload: dict):
        def txn(cur):
            cur.execute("INSERT IGNORE INTO webhook_receipts(webhook_id,topic,received_at) VALUES(%s,%s,%s)",
                        (webhook_id, topic, utcnow()))
            if cur.rowcount == 0:
                return {"ok": True, "duplicate": True}
            order_id = txt(payload.get("id"), 64)
            if topic.startswith("orders/"):
                if not order_id:
                    raise ValueError("Pedido sin ID")
                customer = payload.get("customer") or {}
                if not isinstance(customer, dict):
                    raise ValueError("Cliente inválido")
                self._upsert_customer(cur, customer)
                customer_id = txt(customer.get("id"), 64)
                email = txt(payload.get("email") or customer.get("email"), 254)
                cur.execute("""INSERT INTO orders(order_id,name,customer_id,email_encrypted,total,currency,financial_status,
                    fulfillment_status,created_at,updated_at,cancelled_at,last_event)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE name=VALUES(name),customer_id=VALUES(customer_id),
                    email_encrypted=VALUES(email_encrypted),total=VALUES(total),currency=VALUES(currency),
                    financial_status=VALUES(financial_status),fulfillment_status=VALUES(fulfillment_status),
                    created_at=VALUES(created_at),updated_at=VALUES(updated_at),cancelled_at=VALUES(cancelled_at),last_event=VALUES(last_event)""",
                    (order_id, txt(payload.get("name"), 120) or order_id, customer_id,
                     encrypted_field(self.key,email,"order:email"), money(payload.get("current_total_price",payload.get("total_price"))),
                     txt(payload.get("currency"), 8) or "EUR",txt(payload.get("financial_status"),48),
                     txt(payload.get("fulfillment_status"),48),txt(payload.get("created_at"),45),
                     txt(payload.get("updated_at"),45) or utcnow(),txt(payload.get("cancelled_at"),45),topic))
                cur.execute("DELETE FROM order_items WHERE order_id=%s",(order_id,))
                lines = payload.get("line_items") or []
                if not isinstance(lines, list) or len(lines) > 500:
                    raise ValueError("Líneas del pedido inválidas")
                for index, line in enumerate(lines):
                    if not isinstance(line, dict):
                        raise ValueError("Línea inválida")
                    cur.execute("""INSERT INTO order_items(order_id,line_id,product_id,variant_id,title,sku,quantity,price)
                        VALUES(%s,%s,%s,%s,%s,%s,%s,%s)""",
                        (order_id,txt(line.get("id"),64) or str(index),txt(line.get("product_id"),64),
                         txt(line.get("variant_id"),64),txt(line.get("title"),300) or "Artículo",
                         txt(line.get("sku"),120),int(line.get("quantity") or 0),money(line.get("price"))))
                cur.execute("""INSERT INTO sales(order_id,gross_total,currency,payment_status,updated_at)
                    VALUES(%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE gross_total=VALUES(gross_total),
                    currency=VALUES(currency),payment_status=VALUES(payment_status),updated_at=VALUES(updated_at)""",
                    (order_id,money(payload.get("current_total_price",payload.get("total_price"))),
                     txt(payload.get("currency"),8) or "EUR",txt(payload.get("financial_status"),48),
                     txt(payload.get("updated_at"),45) or utcnow()))
            elif topic in {"customers/create","customers/update"}:
                if not payload.get("id"):
                    raise ValueError("Cliente sin ID")
                self._upsert_customer(cur,payload)
            elif topic in {"customers/redact","customers/delete"}:
                customer = payload.get("customer") or payload
                cid = txt(customer.get("id"),64) if isinstance(customer,dict) else None
                ids = set(txt(x,64) for x in payload.get("orders_to_redact",[]) if x is not None)
                if cid:
                    cur.execute("SELECT order_id FROM orders WHERE customer_id=%s",(cid,))
                    ids.update(row["order_id"] for row in cur.fetchall())
                for oid in ids:
                    if oid:
                        cur.execute("UPDATE orders SET email_encrypted=NULL,customer_id=NULL WHERE order_id=%s",(oid,))
                if cid:
                    cur.execute("DELETE FROM customers WHERE customer_id=%s",(cid,))
            elif topic in {"products/create","products/update"}:
                if not order_id:
                    raise ValueError("Producto sin ID")
                cur.execute("""INSERT INTO products(product_id,title,vendor,product_type,status,updated_at)
                    VALUES(%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE title=VALUES(title),vendor=VALUES(vendor),
                    product_type=VALUES(product_type),status=VALUES(status),updated_at=VALUES(updated_at)""",
                    (order_id,txt(payload.get("title"),300) or "Artículo",txt(payload.get("vendor"),150),
                     txt(payload.get("product_type"),150),txt(payload.get("status"),24),txt(payload.get("updated_at"),45) or utcnow()))
                cur.execute("DELETE FROM product_variants WHERE product_id=%s",(order_id,))
                for variant in (payload.get("variants") or [])[:500]:
                    if not isinstance(variant,dict) or not variant.get("id"):
                        continue
                    cur.execute("""INSERT INTO product_variants(variant_id,product_id,title,sku,price,inventory_item_id)
                        VALUES(%s,%s,%s,%s,%s,%s)""",
                        (txt(variant["id"],64),order_id,txt(variant.get("title"),300),
                         txt(variant.get("sku"),120),money(variant.get("price")),txt(variant.get("inventory_item_id"),64)))
            elif topic == "products/delete":
                if not order_id:
                    raise ValueError("Producto sin ID")
                cur.execute("DELETE FROM products WHERE product_id=%s",(order_id,))
            elif topic == "inventory_levels/update":
                item, loc = txt(payload.get("inventory_item_id"),64),txt(payload.get("location_id"),64)
                if not item or not loc:
                    raise ValueError("Inventario inválido")
                available = payload.get("available")
                cur.execute("""INSERT INTO inventory(inventory_item_id,location_id,available,updated_at)
                    VALUES(%s,%s,%s,%s) ON DUPLICATE KEY UPDATE available=VALUES(available),updated_at=VALUES(updated_at)""",
                    (item,loc,int(available) if available is not None else None,utcnow()))
            elif topic == "shop/redact":
                for table in ("order_items","sales","orders","customers","product_variants","products","inventory","audit_events","webhook_receipts"):
                    cur.execute("DELETE FROM `"+table+"`")  # trusted allowlist only
                cur.execute("INSERT INTO webhook_receipts(webhook_id,topic,received_at) VALUES(%s,%s,%s)",(webhook_id,topic,utcnow()))
            cur.execute("INSERT INTO audit_events(created_at,actor,action,target,event_type) VALUES(%s,%s,%s,%s,%s)",
                        (utcnow(),"shopify-webhook",topic,order_id if topic.startswith(("orders/","products/")) else None,"shopify"))
            return {"ok":True,"duplicate":False}
        return self.change(txn)

    def audit(self, action: str, target: str | None):
        def txn(cur):
            cur.execute("INSERT INTO audit_events(created_at,actor,action,target,event_type) VALUES(%s,%s,%s,%s,%s)",
                        (utcnow(),"panel-admin",action,target,"admin"))
            return {"ok":True}
        return self.change(txn)

    def encrypted_backup(self) -> bytes:
        # Small-shop export. Never writes SQL plaintext on disk. Snapshot transaction.
        parts = io.StringIO()
        parts.write("-- ALANTIS SPORT MySQL portable backup (sensitive)\nSET FOREIGN_KEY_CHECKS=0;\n")
        with self.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
                cur.execute("START TRANSACTION WITH CONSISTENT SNAPSHOT")
                for table in TABLES:  # hardcoded names only; no user SQL
                    cur.execute("SHOW CREATE TABLE `"+table+"`")
                    row = cur.fetchone()
                    ddl = row["Create Table"]
                    parts.write("DROP TABLE IF EXISTS `"+table+"`;\n")
                    parts.write(ddl+";\n")
                    cur.execute("SELECT * FROM `"+table+"`")
                    cols = [x[0] for x in cur.description]
                    names = ",".join("`"+c+"`" for c in cols)
                    for item in cur.fetchall():
                        sql=cur.mogrify("INSERT INTO `"+table+"` ("+names+") VALUES ("+(",".join(["%s"]*len(cols)))+");",
                                        tuple(item[c] for c in cols))
                        parts.write(sql+"\n")
                    if parts.tell() > MAX_BACKUP:
                        raise ValueError("Exportación demasiado grande: utiliza copia gestionada externa")
                conn.rollback()
        parts.write("SET FOREIGN_KEY_CHECKS=1;\n")
        sql=parts.getvalue().encode("utf-8")
        if len(sql)>MAX_BACKUP:
            raise ValueError("Exportación demasiado grande")
        return crypt_backup(self.key,sql)


_store: MySQLStore | None = None


def store():
    global _store
    if _store is None:
        _store = MySQLStore()
    return _store


@asynccontextmanager
async def lifespan(_app):
    store()  # startup fails closed if secrets, database, or schema are unavailable
    yield


app = FastAPI(title="ALANTIS SPORT · MySQL privado", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(CORSMiddleware,
                   allow_origins=[os.getenv("ALANTIS_ALLOWED_ORIGIN","https://byl0ke.github.io").rstrip("/")],
                   allow_methods=["GET","POST"],allow_headers=["Authorization","Content-Type"],max_age=600)


def authorize(authorization: str | None):
    expected=store().admin_token
    if not authorization or not authorization.startswith("Bearer ") or not secrets.compare_digest(authorization[7:],expected):
        raise HTTPException(status_code=401,detail="No autorizado")


@app.middleware("http")
async def no_cache(request: Request,call_next):
    response=await call_next(request)
    if request.url.path.startswith("/api/admin/"):
        response.headers.update({"Cache-Control":"no-store","Pragma":"no-cache","X-Content-Type-Options":"nosniff"})
    return response


@app.get("/health")
async def health():
    try:
        ok=await run_in_threadpool(lambda:store().health())
    except Exception:
        raise HTTPException(status_code=503,detail="Base de datos no disponible") from None
    if not ok:
        raise HTTPException(status_code=503,detail="Base de datos no disponible")
    return {"status":"ok","database":"mysql"}


@app.post("/webhooks/shopify")
async def webhook(request:Request,x_shopify_hmac_sha256:str|None=Header(default=None),
                  x_shopify_topic:str|None=Header(default=None),x_shopify_webhook_id:str|None=Header(default=None),
                  x_shopify_shop_domain:str|None=Header(default=None)):
    if x_shopify_topic not in TOPICS:
        raise HTTPException(status_code=400,detail="Tema no permitido")
    if x_shopify_shop_domain != os.getenv("ALANTIS_ALLOWED_SHOP","psm7b6-qs.myshopify.com"):
        raise HTTPException(status_code=403,detail="Tienda no permitida")
    if not x_shopify_webhook_id or len(x_shopify_webhook_id)>128:
        raise HTTPException(status_code=400,detail="Identificador del webhook inválido")
    if request.headers.get("content-length"):
        try:
            if int(request.headers["content-length"])>MAX_BODY:
                raise HTTPException(status_code=413,detail="Evento demasiado grande")
        except ValueError:
            raise HTTPException(status_code=400,detail="Content-Length inválido") from None
    raw=await request.body()
    if len(raw)>MAX_BODY:
        raise HTTPException(status_code=413,detail="Evento demasiado grande")
    signature=base64.b64encode(hmac.new(store().webhook_secret.encode(),raw,hashlib.sha256).digest()).decode("ascii")
    if not x_shopify_hmac_sha256 or not hmac.compare_digest(x_shopify_hmac_sha256,signature):
        raise HTTPException(status_code=401,detail="Firma Shopify inválida")
    try:
        payload=json.loads(raw)
        if not isinstance(payload,dict):
            raise ValueError("Datos inválidos")
        return await run_in_threadpool(store().accept_webhook,x_shopify_topic,x_shopify_webhook_id,payload)
    except (ValueError,TypeError,pymysql.MySQLError):
        raise HTTPException(status_code=422,detail="Datos del webhook inválidos") from None


@app.get("/api/admin/summary")
async def summary(authorization:str|None=Header(default=None)):
    authorize(authorization)
    return await run_in_threadpool(store().counts)


@app.get("/api/admin/orders")
async def orders(authorization:str|None=Header(default=None),limit:int=50):
    authorize(authorization)
    return {"orders":await run_in_threadpool(store().list_orders,max(1,min(limit,100)))}


@app.get("/api/admin/logs")
async def logs(authorization:str|None=Header(default=None),limit:int=100):
    authorize(authorization)
    return {"logs":await run_in_threadpool(store().list_events,max(1,min(limit,200)))}


@app.get("/api/admin/customers")
async def customers(authorization:str|None=Header(default=None),limit:int=50):
    authorize(authorization)
    return {"customers":await run_in_threadpool(store().list_customers,max(1,min(limit,100)))}


@app.get("/api/admin/products")
async def products(authorization:str|None=Header(default=None),limit:int=50):
    authorize(authorization)
    return {"products":await run_in_threadpool(store().list_products,max(1,min(limit,100)))}


@app.get("/api/admin/inventory")
async def inventory(authorization:str|None=Header(default=None),limit:int=50):
    authorize(authorization)
    return {"inventory":await run_in_threadpool(store().list_inventory,max(1,min(limit,100)))}


@app.get("/api/admin/sales")
async def sales(authorization:str|None=Header(default=None),limit:int=50):
    authorize(authorization)
    return {"sales":await run_in_threadpool(store().list_sales,max(1,min(limit,100)))}


@app.post("/api/admin/audit")
async def audit(request:Request,authorization:str|None=Header(default=None)):
    authorize(authorization)
    body=await request.body()
    if len(body)>4096:
        raise HTTPException(status_code=413,detail="Registro demasiado grande")
    try:
        data=json.loads(body)
        if not isinstance(data,dict):raise ValueError()
        action=txt(data.get("action"),100)
        target=txt(data.get("target"),250)
        if not action or len(action)<3:raise ValueError()
    except (ValueError,TypeError):
        raise HTTPException(status_code=422,detail="Registro inválido") from None
    return await run_in_threadpool(store().audit,action,target)


@app.get("/api/admin/backup")
async def backup(authorization:str|None=Header(default=None)):
    authorize(authorization)
    try:
        content=await run_in_threadpool(store().encrypted_backup)
    except ValueError:
        raise HTTPException(status_code=413,detail="Copia demasiado grande; usa el sistema externo de backups") from None
    return Response(content,media_type="application/octet-stream",headers={
        "Content-Disposition":'attachment; filename="alantis-mysql.sql.enc"',
        "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"})