# ALANTIS SPORT · Docker Compose MySQL

Archivo principal: `compose.yaml`. Debe ejecutarse desde un **VPS propio**, no desde GitHub Pages. La tienda pública continúa en `https://byl0ke.github.io/alantis-sport/`.

Guía paso a paso: [../../GUIA-MYSQL.md](../../GUIA-MYSQL.md).

Usa un nombre DNS público y `.env` con secretos. `mysql` no publica puertos y mantiene `/var/lib/mysql` en un volumen persistente. `api` expone solo tráfico detrás del proxy HTTPS Caddy. No se crean bases de datos ni se cobran planes por subir estos archivos a GitHub.