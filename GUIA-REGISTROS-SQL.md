# ALANTIS SPORT — Registro de pedidos y eventos en SQL cifrado

## Estado actual

**Código listo y probado en local; NO hay todavía un servidor desplegado ni una suscripción real a los webhooks de Shopify.** GitHub Pages no puede ejecutar Python ni guardar bases de datos. Mientras no se configure el servidor, no se almacenarán pedidos en este archivo.

## ¿Dónde se guarda?

- El backend privado `backend/main.py` guarda un único archivo en un disco persistente: `ALANTIS_DATA_DIR/pedidos.sql.enc` (por defecto `/data/pedidos.sql.enc`).
- El contenido es una **exportación SQL de SQLite cifrada con AES-256-GCM**, no un fichero `.db` de SQLCipher. No se almacena `.sql` ni `.db` legible en disco. Se recupera y consulta en una base SQLite **en memoria**.
- El archivo incluye tablas: `orders`, `order_items`, `webhook_receipts` y `audit_events`, con control de duplicados de las notificaciones.
- Incluye identificadores, artículos, importes, divisa, estado, fecha y correo del pedido. NO incluye datos de tarjetas. No duplica las direcciones de envío; para esos datos se consulta Shopify.
- Con webhook firmado `orders/create`, `orders/updated` y `orders/cancelled`, Shopify es la fuente de la información. Hay soporte básico para solicitudes de borrado `customers/redact` y `shop/redact`; consulta los requisitos legales completos de tu tienda y conserva también una política para destruir copias antiguas.
- Las publicaciones del catálogo se registran en `audit_events` **solo cuando el administrador tiene conectado el backend con su token**. Los cambios de borrador locales y las visitas a la web **no** se registran automáticamente.

## Publicación del backend (requiere hosting privado)

**No despliegues datos de clientes en GitHub ni metas secretos en archivos `.html`, `.js`, `.json` o commits.**

1. Contrata o configura un servicio que ejecute el `backend/Dockerfile` con HTTPS y un volumen persistente montado en `/data`. Configura **una réplica y un trabajador** (`--workers 1`), ya que la base es SQLite en memoria. El archivo y su clave deben sobrevivir a los reinicios. No uses disco efímero.
2. Genera en una máquina de confianza, sin enviarlas por chat, dos credenciales fuertes. Ejemplo:
   ```bash
   python -c 'import base64,secrets; print(base64.b64encode(secrets.token_bytes(32)).decode())'  # ALANTIS_SQL_KEY_B64
   python -c 'import secrets; print(secrets.token_urlsafe(48))'  # ALANTIS_ADMIN_TOKEN
   ```
3. Introduce **solo en la sección Secrets/Environment del proveedor**:
   - `ALANTIS_SQL_KEY_B64`: clave AES aleatoria base64 de 32 bytes (imprescindible para descifrar copias).
   - `ALANTIS_ADMIN_TOKEN`: token privado largo para consultas y descargas.
   - `ALANTIS_SHOPIFY_WEBHOOK_SECRET`: secreto real que firma los webhooks de tu tienda de Shopify.
   - `ALANTIS_ALLOWED_SHOP=psm7b6-qs.myshopify.com`
   - `ALANTIS_ALLOWED_ORIGIN=https://byl0ke.github.io`
   - `ALANTIS_DATA_DIR=/data` y `ALANTIS_PORT=8080`.
4. Comprueba `https://TU-SERVIDOR/health`. La respuesta esperada es `{"status":"ok"}`. Después registra en Shopify los webhooks de pedidos (creación, actualización y cancelación) apuntando a `https://TU-SERVIDOR/webhooks/shopify` con la configuración de firma/secreto correcta. Shopify puede exigir una app personalizada con las autorizaciones pertinentes. **No compartas el secreto**.
5. Ve a `https://byl0ke.github.io/alantis-sport/admin.html`, desbloquea la barrera visual y baja a **Pedidos y registros · SQL cifrado**. Introduce la URL del servidor y el **token administrativo del servidor** (no el PIN, no un token de GitHub) y pulsa **Conectar registros**.
6. Haz un pedido de prueba real en Shopify cuando tu tienda esté lista. Comprueba la llegada del evento, el panel, el archivo cifrado y su restauración con la misma clave. Los pedidos anteriores a activar el webhook **no** se importan automáticamente; se requiere una sincronización histórica autorizada.

### Copias y recuperación

- Desde el panel puedes descargar el archivo cifrado `pedidos.sql.enc` con tu token. La copia **no contiene la clave**; conserva la clave separadamente en un gestor de secretos y almacena las copias fuera del repositorio público.
- Para restaurar, con el servidor **apagado**, coloca la copia cifrada en `/data/pedidos.sql.enc` de una instancia que tenga **la misma clave AES**. Arranca una sola réplica y verifica los recuentos. Si pierdes la clave, la copia es irrecuperable.
- Configura un respaldo remoto cifrado automatizado y una política de retención y eliminación conforme al RGPD y tus obligaciones legales. Esta versión guarda un archivo actual y permite descargarlos; **no sustituye un sistema externo de backups automatizados**.
- No uses `git push` para subir el `.sql.enc`: el repositorio es público. Tampoco subas `.env` ni los valores de las claves.

### Seguridad y límites

- El PIN de GitHub Pages solo tapa la interfaz: **no** equivale a autenticación privada. Las consultas y los backups exigen `Authorization: Bearer ...` y el backend restringe CORS al origen de la tienda.
- Usa HTTPS y nunca pegues tokens en URLs. El token se mantiene solo en la memoria de la pestaña tras conectar; al desconectarte se descarta.
- El servidor rechaza webhooks sin HMAC Shopify válido y eventos procedentes de otras tiendas. Descarta duplicados por identificador de webhook. No acepta pagos ni tarjetas.
- Esta implementación está enfocada a un volumen pequeño/medio con una sola instancia. Para alto tráfico, políticas complejas de acceso, múltiples trabajadores o backups gestionados, migra a PostgreSQL en servidor privado con cifrado en reposo, roles y registros.
- Cumple las obligaciones sobre datos personales (base legal, información, retención, derecho de acceso/supresión y acuerdos con el proveedor). Un archivo cifrado sigue siendo tratamiento de datos personales.

## Pruebas del backend

```bash
cd backend
pip install -r requirements.txt
pip install httpx # para pruebas HTTP locales
python -m unittest discover -s tests -v
```

Para pruebas locales sin HTTPS usa `http://localhost:8080`. Nunca lo publiques así.