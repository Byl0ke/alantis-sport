"""ALANTIS SPORT: Shopify webhooks -> encrypted SQL dump on private persistent disk.

This is an AES-256-GCM encrypted SQL *dump*, not a SQLCipher .db file.
Database is exclusively in memory; no plaintext .sql/.db is created on disk.
Run ONE worker/replica and persist /data. Use TLS termination at hosting provider.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

MAGIC = b"ALANTIS-SQL-AES256GCM-v1\n"
MAX_BODY = 2 * 1024 * 1024
TOPICS = {"orders/create", "orders/updated", "orders/cancelled", "customers/redact", "shop/redact"}
SCHEMA = """
CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    customer_id TEXT,
    email TEXT,
    total TEXT NOT NULL,
    currency TEXT NOT NULL,
    financial_status TEXT,
    fulfillment_status TEXT,
    created_at TEXT,
    updated_at TEXT,
    cancelled_at TEXT,
    last_event TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
    order_id TEXT NOT NULL,
    line_id TEXT NOT NULL,
    product_id TEXT,
    variant_id TEXT,
    title TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER NOT NULL,
    price TEXT,
    PRIMARY KEY(order_id, line_id),
    FOREIGN KEY(order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS webhook_receipts (
    webhook_id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    received_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    event_type TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at);
CREATE INDEX IF NOT EXISTS audit_time_idx ON audit_events(created_at);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean(value: Any, max_chars: int = 300) -> str | None:
    if value is None:
        return None
    return str(value)[:max_chars]


class EncryptedSqlStore:
    """One-process transactional SQLite engine with atomic encrypted SQL dumps."""

    def __init__(self, data_dir: Path, key: bytes):
        if len(key) != 32:
            raise ValueError("ALANTIS_SQL_KEY_B64 debe contener exactamente 32 bytes")
        self.key = key
        self.path = data_dir / "pedidos.sql.enc"
        self.lock = threading.RLock()
        data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.conn = sqlite3.connect(":memory:", check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys=ON")
        if self.path.exists():
            raw = self.path.read_bytes()
            if not raw.startswith(MAGIC) or len(raw) <= len(MAGIC) + 12 + 16:
                raise RuntimeError("Archivo SQL cifrado inválido")
            sql = AESGCM(key).decrypt(raw[len(MAGIC):len(MAGIC)+12], raw[len(MAGIC)+12:], MAGIC)
            # SQLite .iterdump() writes tables in name order, potentially writing child rows
            # before parent tables. Restore with FK checks disabled and verify afterwards.
            self.conn.execute("PRAGMA foreign_keys=OFF")
            self.conn.executescript(sql.decode("utf-8"))
            if self.conn.execute("PRAGMA foreign_key_check").fetchone():
                raise RuntimeError("La exportación SQL contiene relaciones inválidas")
            self.conn.execute("PRAGMA foreign_keys=ON")
        else:
            self.conn.executescript(SCHEMA)
            self._persist()

    def _persist(self):
        sql = "\n".join(self.conn.iterdump()).encode("utf-8")
        nonce = os.urandom(12)
        blob = MAGIC + nonce + AESGCM(self.key).encrypt(nonce, sql, MAGIC)
        temp = self.path.with_name(self.path.name + ".tmp")
        try:
            fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "wb") as file:
                file.write(blob)
                file.flush()
                os.fsync(file.fileno())
            os.replace(temp, self.path)
            os.chmod(self.path, 0o600)
            if hasattr(os, "O_DIRECTORY"):
                dir_fd = os.open(self.path.parent, os.O_DIRECTORY | os.O_RDONLY)
                try:
                    os.fsync(dir_fd)
                finally:
                    os.close(dir_fd)
        finally:
            temp.unlink(missing_ok=True)

    def change(self, operation):
        with self.lock:
            self.conn.execute("BEGIN IMMEDIATE")
            try:
                result = operation(self.conn)
                # Persist BEFORE acknowledging/committing; if a disk write fails,
                # rollback preserves Shopify retry behavior (no lost webhook).
                self._persist()
                self.conn.commit()
                return result
            except Exception:
                self.conn.rollback()
                raise

    def list_orders(self, limit: int):
        with self.lock:
            rows = self.conn.execute("SELECT * FROM orders ORDER BY COALESCE(created_at, updated_at) DESC LIMIT ?", (limit,)).fetchall()
            output = []
            for row in rows:
                order = dict(row)
                order["items"] = [dict(r) for r in self.conn.execute("SELECT line_id, product_id, variant_id, title, sku, quantity, price FROM order_items WHERE order_id=?", (row["order_id"],)).fetchall()]
                output.append(order)
            return output

    def list_events(self, limit: int):
        with self.lock:
            rows = self.conn.execute("SELECT created_at, actor, action, target, event_type FROM audit_events ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
            return [dict(row) for row in rows]

    def counts(self):
        with self.lock:
            return {
                "orders": self.conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0],
                "webhooks": self.conn.execute("SELECT COUNT(*) FROM webhook_receipts").fetchone()[0],
                "audit_events": self.conn.execute("SELECT COUNT(*) FROM audit_events").fetchone()[0],
            }

    def backup(self) -> bytes:
        with self.lock:
            return self.path.read_bytes()

    def accept_webhook(self, topic: str, webhook_id: str, payload: dict):
        def op(db):
            try:
                db.execute("INSERT INTO webhook_receipts (webhook_id,topic,received_at) VALUES (?,?,?)", (webhook_id, topic, now()))
            except sqlite3.IntegrityError:
                return {"ok": True, "duplicate": True}

            order_id = clean(payload.get("id"), 48)
            if topic.startswith("orders/"):
                if not order_id:
                    raise ValueError("Pedido sin ID")
                customer = payload.get("customer") or {}
                db.execute("""INSERT INTO orders(order_id,name,customer_id,email,total,currency,financial_status,fulfillment_status,created_at,updated_at,cancelled_at,last_event)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(order_id) DO UPDATE SET name=excluded.name,customer_id=excluded.customer_id,email=excluded.email,total=excluded.total,
                    currency=excluded.currency,financial_status=excluded.financial_status,fulfillment_status=excluded.fulfillment_status,
                    created_at=excluded.created_at,updated_at=excluded.updated_at,cancelled_at=excluded.cancelled_at,last_event=excluded.last_event""",
                    (order_id, clean(payload.get("name"), 100) or order_id, clean(customer.get("id"), 48), clean(payload.get("email") or customer.get("email"), 254),
                    clean(payload.get("current_total_price", payload.get("total_price")), 50) or "0", clean(payload.get("currency"), 10) or "EUR",
                    clean(payload.get("financial_status"), 50), clean(payload.get("fulfillment_status"), 50), clean(payload.get("created_at"), 50),
                    clean(payload.get("updated_at"), 50), clean(payload.get("cancelled_at"), 50), topic))
                db.execute("DELETE FROM order_items WHERE order_id=?", (order_id,))
                for index, line in enumerate(payload.get("line_items") or []):
                    line_id = clean(line.get("id"), 48) or str(index)
                    db.execute("""INSERT INTO order_items(order_id,line_id,product_id,variant_id,title,sku,quantity,price)
                                  VALUES(?,?,?,?,?,?,?,?)""", (
                        order_id, line_id, clean(line.get("product_id"), 48), clean(line.get("variant_id"), 48),
                        clean(line.get("title"), 300) or "Artículo", clean(line.get("sku"), 100),
                        max(0, int(line.get("quantity") or 0)), clean(line.get("price"), 50)))
            elif topic == "customers/redact":
                customer = payload.get("customer") or {}
                cid = clean(customer.get("id"), 48)
                order_ids = {clean(x, 48) for x in payload.get("orders_to_redact") or []}
                if cid:
                    order_ids.update(r[0] for r in db.execute("SELECT order_id FROM orders WHERE customer_id=?", (cid,)))
                for value in order_ids:
                    if value:
                        db.execute("DELETE FROM order_items WHERE order_id=?", (value,))
                        db.execute("DELETE FROM orders WHERE order_id=?", (value,))
            elif topic == "shop/redact":
                db.execute("DELETE FROM order_items")
                db.execute("DELETE FROM orders")
                db.execute("DELETE FROM audit_events")
                db.execute("DELETE FROM webhook_receipts")
            db.execute("INSERT INTO audit_events(created_at,actor,action,target,event_type) VALUES(?,?,?,?,?)",
                       (now(), "shopify-webhook", topic, order_id if topic.startswith("orders/") else None, "shopify"))
            return {"ok": True, "duplicate": False}
        return self.change(op)


@asynccontextmanager
async def lifespan(_app):
    # Nunca anunciar que el servicio está disponible si la clave o el disco fallan.
    db()
    yield


app = FastAPI(title="ALANTIS SPORT · Archivo SQL cifrado", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
_origin = os.getenv("ALANTIS_ALLOWED_ORIGIN", "https://byl0ke.github.io").rstrip("/")
app.add_middleware(CORSMiddleware, allow_origins=[_origin], allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"], max_age=600)
_store: EncryptedSqlStore | None = None


def settings():
    def required(name: str) -> str:
        v = os.getenv(name, "")
        if not v:
            raise RuntimeError("Falta variable secreta: " + name)
        return v
    key = base64.b64decode(required("ALANTIS_SQL_KEY_B64"), validate=True)
    admin = required("ALANTIS_ADMIN_TOKEN")
    webhook = required("ALANTIS_SHOPIFY_WEBHOOK_SECRET")
    if len(admin) < 32 or len(webhook) < 12 or len(key) != 32:
        raise RuntimeError("Las claves de cifrado, administración y webhook no cumplen los requisitos")
    return key, admin, webhook


def db() -> EncryptedSqlStore:
    global _store
    if _store is None:
        key, _, _ = settings()
        _store = EncryptedSqlStore(Path(os.getenv("ALANTIS_DATA_DIR", "/data")), key)
    return _store


def authenticate(authorization: str | None):
    _, expected, _ = settings()
    if not authorization or not authorization.startswith("Bearer ") or not secrets.compare_digest(authorization[7:], expected):
        raise HTTPException(status_code=401, detail="No autorizado")


@app.middleware("http")
async def no_cache_private(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/admin/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/webhooks/shopify")
async def shopify_hook(request: Request,
                       x_shopify_hmac_sha256: str | None = Header(default=None),
                       x_shopify_topic: str | None = Header(default=None),
                       x_shopify_webhook_id: str | None = Header(default=None),
                       x_shopify_shop_domain: str | None = Header(default=None)):
    _, _, secret = settings()
    if x_shopify_topic not in TOPICS:
        raise HTTPException(status_code=400, detail="Tema no permitido")
    if x_shopify_shop_domain != os.getenv("ALANTIS_ALLOWED_SHOP", "psm7b6-qs.myshopify.com"):
        raise HTTPException(status_code=403, detail="Tienda no permitida")
    if not x_shopify_webhook_id or len(x_shopify_webhook_id) > 128:
        raise HTTPException(status_code=400, detail="Falta id del evento")
    if request.headers.get("content-length") and int(request.headers["content-length"]) > MAX_BODY:
        raise HTTPException(status_code=413, detail="Evento demasiado grande")
    body = await request.body()
    if len(body) > MAX_BODY:
        raise HTTPException(status_code=413, detail="Evento demasiado grande")
    expected = base64.b64encode(hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()).decode("ascii")
    if not x_shopify_hmac_sha256 or not hmac.compare_digest(expected, x_shopify_hmac_sha256):
        raise HTTPException(status_code=401, detail="Firma no válida")
    try:
        payload = json.loads(body)
        if not isinstance(payload, dict):
            raise ValueError("Se esperaba un objeto")
        return db().accept_webhook(x_shopify_topic, x_shopify_webhook_id, payload)
    except (ValueError, TypeError, sqlite3.Error):
        raise HTTPException(status_code=422, detail="Datos del webhook inválidos")


@app.get("/api/admin/summary")
def summary(authorization: str | None = Header(default=None)):
    authenticate(authorization)
    return db().counts()


@app.get("/api/admin/orders")
def orders(authorization: str | None = Header(default=None), limit: int = 50):
    authenticate(authorization)
    return {"orders": db().list_orders(min(max(limit, 1), 100))}


@app.get("/api/admin/logs")
def logs(authorization: str | None = Header(default=None), limit: int = 100):
    authenticate(authorization)
    return {"logs": db().list_events(min(max(limit, 1), 200))}


@app.post("/api/admin/audit")
async def audit(request: Request, authorization: str | None = Header(default=None)):
    authenticate(authorization)
    raw = await request.body()
    if len(raw) > 4096:
        raise HTTPException(status_code=413, detail="Registro demasiado grande")
    try:
        payload = json.loads(raw)
        action = clean(payload.get("action"), 90)
        target = clean(payload.get("target"), 250)
    except (AttributeError, ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Registro inválido")
    if not action or len(action) < 3:
        raise HTTPException(status_code=422, detail="Acción demasiado corta")
    def write(conn):
        conn.execute("INSERT INTO audit_events(created_at,actor,action,target,event_type) VALUES(?,?,?,?,?)",
                     (now(), "panel-admin", action, target, "admin"))
        return {"ok": True}
    return db().change(write)


@app.get("/api/admin/backup")
def download_backup(authorization: str | None = Header(default=None)):
    authenticate(authorization)
    return Response(db().backup(), media_type="application/octet-stream", headers={
        "Content-Disposition": 'attachment; filename="pedidos.sql.enc"',
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"
    })