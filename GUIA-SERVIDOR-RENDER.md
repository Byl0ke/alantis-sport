# ALANTIS SPORT — servidor privado desde cero (Render)

## Antes de crear nada

La web pública sigue en **GitHub Pages**; el servidor Render recibe **webhooks Shopify**, guarda un archivo `pedidos.sql.enc` cifrado con AES-256-GCM en un **disco persistente `/data`**, y expone endpoints de consulta que **requieren token**. El código del servidor está en `backend/`. Los registros personales NO se guardan en el repositorio público.

**No es un servicio gratuito.** Render necesita servidor de pago para montar disco persistente: configuración `0.5c-512mb` (desde US$7/mes) más disco de 1 GB (US$0.25/mes), sin incluir impuestos ni consumos extra. Comprueba el precio que indique Render **antes de confirmar el pago**. Un servicio Free **no** es válido porque perdería el archivo en reinicios.

## 1. Crear cuenta y conectar GitHub

1. Entra en https://dashboard.render.com/ e inicia sesión o crea tu cuenta.
2. Autoriza el acceso de Render al repositorio `Byl0ke/alantis-sport` (puedes limitar el acceso solo a este repositorio).
3. El proyecto tiene `render.yaml` en su raíz. En Render, selecciona **New > Blueprint** y el repositorio `Byl0ke/alantis-sport`. Render mostrará el servicio `alantis-sport-api`.
4. Revisa **antes de aceptar**: región **Frankfurt**, plan `0.5c-512mb`, **un único servicio**, y disco persistente **1 GB** montado en `/data`.

## 2. Configurar secretos (NO se envían por chat, GitHub ni correo)

Render solicitará 3 variables **secretas**. Genéralas en **tu propio ordenador**, usando Python instalado localmente. No copies las salidas a ChatGPT.

En PowerShell o terminal (ejecuta cada una por separado):

```bash
python -c "import base64,secrets; print(base64.b64encode(secrets.token_bytes(32)).decode())"
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Guarda cada valor inmediatamente en un gestor de contraseñas:

- `ALANTIS_SQL_KEY_B64` = salida del **primer** comando: clave AES de 32 bytes codificados en base64. **No la cambies después de comenzar a recibir pedidos**, o perderás acceso al archivo existente. Guarda copia de recuperación separada del archivo.
- `ALANTIS_ADMIN_TOKEN` = salida del **segundo** comando: contraseña de la API administrativa, distinta del PIN visual de GitHub Pages.
- `ALANTIS_SHOPIFY_WEBHOOK_SECRET` = **secreto real de firma de webhook de Shopify**, obtenido de la app/configuración correspondiente en Shopify. No es la contraseña de Shopify y no debes inventarlo ni usar aquí el PIN `070708`.

El Blueprint define automáticamente estas variables públicas:

- `ALANTIS_ALLOWED_SHOP=psm7b6-qs.myshopify.com`
- `ALANTIS_ALLOWED_ORIGIN=https://byl0ke.github.io`
- `ALANTIS_DATA_DIR=/data`
- `ALANTIS_PORT=8080`

No subas nunca `.env`, claves, tokens, SQL descifrado ni copias de pedidos a GitHub.

## 3. Crear el servicio y comprobar

1. Tras comprobar las tarifas y los secretos, confirma la creación en Render.
2. Espera el estado **Live**. Copia la URL HTTPS **real que muestre Render**; no supongas que el subdominio será exactamente igual al nombre del servicio.
3. Abre `https://TU-SERVIDOR-REAL/health`. La respuesta esperada es `{"status":"ok"}`. Esa ruta indica que el proceso respondió: no comprueba por sí sola la recepción de pedidos.
4. Si falla, consulta los logs de despliegue en Render. No publiques capturas que muestren variables secretas.

## 4. Conectar los pedidos de Shopify

1. En Shopify, identifica el mecanismo de webhooks autenticados de tu app Shopify. Configura el endpoint HTTPS `https://TU-SERVIDOR-REAL/webhooks/shopify` para **orders/create**, **orders/updated** y **orders/cancelled**; configura también los eventos obligatorios de privacidad según la app.
2. Usa el **mismo secreto de firma real** con el que Shopify firma esos webhooks, introducido únicamente en los secretos de Render.
3. Comprueba que el webhook enviado incluye el dominio de la tienda correcta y firma HMAC válida. El backend rechaza notificaciones sin firma válida.
4. Accede al panel visual `https://byl0ke.github.io/alantis-sport/admin.html`, abre la sección **Pedidos y registros · SQL cifrado**, introduce **la URL HTTPS real** del servidor y el `ALANTIS_ADMIN_TOKEN` generado; pulsa **Conectar registros**.
5. Realiza un pedido de prueba **en Shopify en un modo de prueba permitido**, comprueba que llega un evento, vuelve a consultar el panel y descarga una copia cifrada. No pruebes pagos reales innecesarios.

**ATENCIÓN:** los productos y el checkout de ALANTIS SPORT siguen sin conectarse automáticamente por el hecho de desplegar esta API. Los pedidos anteriores a activar los webhooks no aparecerán sin importación histórica autorizada.

## 5. Backups y seguridad

- Guarda copias periódicas del archivo `pedidos.sql.enc` fuera de GitHub, en ubicación segura distinta del servidor; la clave AES debe permanecer en el gestor de contraseñas por separado. Sin clave no se pueden descifrar las copias.
- No uses el PIN `070708` como clave administrativa, clave de cifrado ni secreto de Shopify: ese PIN es una barrera visual pública, **no autenticación real**.
- Revisa la política de conservación, supresión y acceso a datos de clientes conforme al RGPD. La región Frankfurt no reemplaza esas obligaciones.
- En producción, configura también copias automáticas externas, controles de acceso más fuertes para usuarios administrativos y una prueba de restauración. Render ofrece snapshots de disco, pero no sustituyen los backups de aplicación.
- El servidor debe ejecutarse con **un único worker** y **un solo servicio con disco**. No crees réplicas porque la base se reconstruye en memoria en el proceso.

## 6. Coste y opciones

- Detalles del formato Blueprint: https://render.com/docs/blueprint-spec
- Disco persistente y snapshots: https://render.com/docs/disks
- Lista de precios vigente: https://render.com/pricing

Nada se despliega automáticamente solo por subir este `render.yaml`. Debes autorizar Render, aportar los secretos y aceptar expresamente los costes.