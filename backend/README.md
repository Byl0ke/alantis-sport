# ALANTIS SPORT — Backend de registros y pedidos

Servicio FastAPI que recibe webhooks HMAC firmados de Shopify y guarda una exportación SQL de SQLite cifrada con AES-256-GCM. Los datos solo viven en memoria y en `/data/pedidos.sql.enc` cifrado. **Un solo proceso con un trabajador**, volumen persistente y HTTPS en el proveedor.

Consulta [../GUIA-REGISTROS-SQL.md](../GUIA-REGISTROS-SQL.md) para desplegar, generar claves, configurar Shopify y restaurar copias.

Rutas:
- `GET /health` (estado básico, sin datos)
- `POST /webhooks/shopify` (solo webhooks con firma HMAC válida de tienda autorizada)
- `GET /api/admin/summary`, `/orders`, `/logs`, `/backup` (requieren token administrativo secreto)
- `POST /api/admin/audit` (registros administrativos autorizados)

No hay tarjetas, pasarela de pago ni secretos en este repositorio. El frontend no almacena tokens. La base **no** se guarda en GitHub Pages ni en GitHub público.