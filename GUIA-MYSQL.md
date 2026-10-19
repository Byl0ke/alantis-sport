# ALANTIS SPORT · MySQL privado desde cero (sin secretos en GitHub)

## Estado verificable

- **Preparado en código, NO desplegado en un servidor y sin pedidos reales en MySQL.**
- La tienda sigue en GitHub Pages. No conecta directamente con MySQL: todo pasa por `backend/mysql/main.py` con HTTPS, token administrativo y webhooks HMAC de Shopify.
- El backend **anterior** `backend/main.py` (SQLite cifrado) se conserva para no romper ni borrar datos mientras migramos. El `render.yaml` histórico sigue describiendo ese backend: **NO lo uses para desplegar MySQL**. Para la nueva infraestructura usa `deploy/mysql/compose.yaml` en un VPS.
- El sistema SQL recibe pedidos nuevos **una vez conectados los webhooks**. Pedidos antiguos requieren una importación autorizada desde Shopify.

## Estructura MySQL

| Tabla | Información |
| --- | --- |
| `customers` | ID de Shopify, email/nombre/apellidos cifrados por la aplicación |
| `products` | Productos sincronizados desde Shopify; no se mezclan con la demo de `products.json` |
| `product_variants` | Variantes, SKU, precios, referencias de inventario |
| `inventory` | Nivel de existencias por ubicación recibidos de Shopify |
| `orders` | Pedidos, estados, importe, cliente (email cifrado) |
| `order_items` | Artículos y cantidades del pedido |
| `sales` | Resumen de importes/estado del pedido, **no contabilidad de pagos capturados** |
| `webhook_receipts` | Detección de webhooks repetidos |
| `audit_events` | Registro de notificaciones y acciones auditadas del administrador |

Shopify es la fuente autorizada para cobros y pedidos; MySQL guarda un espejo informativo. No se guardan números de tarjeta ni direcciones postales completas.

## 1. Contrata un VPS, dominio/subdominio y activa HTTPS

Ejemplo: VPS Linux 64 bits con Docker y Docker Compose, memoria adecuada para MySQL 8.4 y espacio para copias. Antes de contratar, consulta coste del VPS, renovación, tráfico, backups y región (elige UE si es apropiado para tus clientes). Crear VPS o servicio de pago requiere tu confirmación.

Crea un subdominio, por ejemplo `api.tu-dominio.com`, con registro A dirigido a la IP del VPS. Abre los puertos 80 y 443 en el cortafuegos. **No abras el puerto 3306 a internet**.

## 2. Instalación en servidor (no ejecutes en GitHub Pages)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
sudo mkdir -p /opt/alantis-sport
sudo chown "$USER:$USER" /opt/alantis-sport
cd /opt/alantis-sport
git clone https://github.com/Byl0ke/alantis-sport.git .
cd deploy/mysql
cp .env.example .env
chmod 600 .env
```

Modifica `.env` **solo en el servidor**. Necesitarás:

- `ALANTIS_API_HOST`: subdominio apuntando al VPS (no hace falta incluir `https://`).
- `MYSQL_ROOT_PASSWORD`: contraseña aleatoria fuerte para MySQL root.
- `MYSQL_PASSWORD`: contraseña aleatoria fuerte del usuario `alantis_api`.
- `ALANTIS_SQL_KEY_B64`: clave aleatoria de exactamente 32 bytes codificada en Base64, necesaria para cifrar emails y backups.
- `ALANTIS_ADMIN_TOKEN`: token privado distinto del PIN del panel, para consultar datos desde el backend.
- `ALANTIS_SHOPIFY_WEBHOOK_SECRET`: secreto de firma HMAC de la app o suscripción Shopify.

Genera localmente las credenciales y **NO las pegues en ChatGPT, GitHub, mensajes ni capturas**:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))' # contraseña o token
python3 -c 'import os,base64; print(base64.b64encode(os.urandom(32)).decode())' # AES-256
```

**Guarda una copia de `ALANTIS_SQL_KEY_B64` en un gestor de secretos:** perderla hace ilegibles los datos personales y las exportaciones cifradas. Asegura también una estrategia de rotación de credenciales.

## 3. Inicia MySQL, API y HTTPS

```bash
cd /opt/alantis-sport/deploy/mysql
docker compose config --quiet     # comprueba el YAML; NO compartas la salida completa porque puede incluir secretos
docker compose up -d --build
docker compose ps
```

El `compose.yaml` inicializa MySQL y las tablas automáticamente, genera HTTPS mediante Caddy y conecta el backend por una red Docker privada. Los datos SQL se conservan en un volumen Docker. Caddy requiere un DNS válido y puertos 80/443 accesibles para emitir el certificado TLS.

Verifica desde tu navegador:

```text
https://api.tu-dominio.com/health
```

Resultado esperado: `{"status":"ok","database":"mysql"}`. Si falla revisa `docker compose logs --tail 100 api mysql caddy` **sin compartir posibles datos privados**.

## 4. Conecta Shopify, solo tras validar el HTTPS

- Tienda conocida: `psm7b6-qs.myshopify.com`.
- Crea una app/suscripciones de webhook de Shopify con la firma secreta correspondiente, apuntando a `https://api.tu-dominio.com/webhooks/shopify`. Las suscripciones deben habilitarse según permisos Shopify y normativa de privacidad.
- Temas implementados: `orders/create`, `orders/updated`, `orders/cancelled`, `products/create`, `products/update`, `products/delete`, `inventory_levels/update`, `customers/create`, `customers/update`, `customers/delete`, `customers/redact`, `shop/redact`.
- Verifica una orden de prueba y que el webhook recibe HTTP 200 firmado. Si Shopify devuelve 401 se debe revisar la firma y el secreto; si 500/503, el servicio no está listo.
- Confirma con Shopify qué temas y permisos están disponibles, incluyendo los eventos de privacidad y los webhooks obligatorios. No inventes claves, tokens ni pedidos.

## 5. Panel privado en una página

Abre `https://byl0ke.github.io/alantis-sport/admin.html#sql-cifrado`.

1. El PIN actual es **solo una barrera visual**. Cualquier usuario puede ver HTML/JS de GitHub Pages. **Nunca trates el PIN como control de seguridad.**
2. En "URL del servidor" escribe `https://api.tu-dominio.com`.
3. En "Token administrativo" usa `ALANTIS_ADMIN_TOKEN` sin compartirlo con nadie. No es el PIN ni un token de GitHub.
4. Pulsa "Conectar registros". Las secciones de pedidos, clientes, productos Shopify, inventario, ventas y auditoría mostrarán los datos recibidos.
5. Pulsa "Copia SQL cifrada" para obtener `alantis-mysql.sql.enc`. El panel nunca guarda las claves en GitHub ni en localStorage.

## 6. Cifrado y copias: qué está protegido realmente

- `ALANTIS_SQL_KEY_B64` cifra por aplicación emails, nombre y apellidos mediante AES-256-GCM con nonce aleatorio único por escritura. La clave solo reside en el servidor.
- Las **exportaciones** `alantis-mysql.sql.enc` se cifran íntegramente con AES-256-GCM. La exportación por API está limitada a 20 MiB, adecuada para tiendas pequeñas, no una solución de backups gestionados para grandes volúmenes.
- **MySQL 8.4 por sí solo no garantiza cifrado completo del volumen local** en esta configuración. Utiliza **cifrado de disco del proveedor / LUKS** y copias cifradas fuera del VPS. Los metadatos no personales como importes y SKUs no se cifran individualmente dentro de MySQL.
- El volumen no sustituye copias externas. Programa backups cifrados verificables, retención y pruebas de restauración (las copias no deben incluirse en repositorios públicos).
- Las respuestas del API requieren autenticación para datos y HTTPS público. CORS limita navegadores de otro origen, pero **no** es una medida de autorización.
- En el ejemplo Docker la API se comunica con MySQL por red interna. Si usas MySQL externo exige TLS con CA e identidad verificadas mediante `MYSQL_SSL_MODE=required` y `MYSQL_SSL_CA=/ruta/ca.pem`.
- Cumple RGPD: política de privacidad, contratos de tratamiento, minimización y conservación. La eliminación/anomización recibida de Shopify no sustituye un procedimiento legal de supresión total, especialmente para backups y artículos personalizados.

## 7. Migración y reversión sin pérdida de datos

1. **No borres** `backend/main.py` ni ningún `pedidos.sql.enc` previo hasta tener respaldos verificables.
2. Levanta MySQL nuevo y prueba eventos falsos/reales autorizados en un entorno de ensayo.
3. Si existen pedidos históricos, impórtalos desde Shopify o la exportación anterior con un script revisado para evitar duplicados. No se importan solos.
4. No cambies tráfico productivo ni los webhooks hasta verificar lecturas, datos, borrados, backup y recuperación.
5. Si falla el nuevo servidor, desactiva los webhooks dirigidos al nuevo endpoint y conserva el backend anterior para revisión.

## 8. Pruebas disponibles

Pruebas de cifrado, autenticación de backup y rechazo HMAC no autorizado:

```bash
cd backend/mysql
python -m pip install -r requirements.txt 'httpx>=0.27,<1'
python -m unittest discover -s tests -v
```

Sin VPS ni conexión MySQL real, estas pruebas **NO confirman** persistencia real, transacciones, sincronización Shopify, TLS o restauración de datos. Haz esa comprobación antes de activar pedidos reales.