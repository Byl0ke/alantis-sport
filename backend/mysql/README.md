# Backend MySQL privado · ALANTIS SPORT

- FastAPI + PyMySQL + MySQL 8.4, claves solo en el servidor.
- Los webhooks Shopify se verifican con HMAC SHA-256 y se deduplican por identificador.
- Operaciones MySQL transaccionales; el panel consulta mediante rutas `/api/admin/*` protegidas por Bearer token.
- Emails y nombres cifrados con AES-256-GCM por campo; exportaciones SQL descargables cifradas con AES-256-GCM.
- MySQL **no está expuesto a Internet** en el Docker Compose; se necesita cifrado de disco en el alojamiento para proteger todos los registros en reposo.
- Shopify sigue gestionando pagos y pedidos reales; ventas aquí son resúmenes, no contabilidad definitiva.

Guía completa: [../../GUIA-MYSQL.md](../../GUIA-MYSQL.md).