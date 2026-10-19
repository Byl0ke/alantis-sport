# ALANTIS SPORT · Conectar la tienda a Shopify

**Estado actual:** preparado, sin ventas reales. La tienda Shopify vinculada `psm7b6-qs.myshopify.com` está en plan trial y no contiene productos. Por eso `checkoutEnabled` está en `false`.

## Activación segura, paso a paso

1. Abre `https://admin.shopify.com/store/psm7b6-qs` e inicia sesión.
2. Selecciona un plan compatible antes de cobrar. Configura el proveedor de pagos desde Settings → Payments.
3. Añade solo artículos que realmente puedas vender, con proveedor, fotos, tallas/variantes, stock y precio final. Publica en el canal Online Store.
4. Copia en cada producto su ID numérico de variante de Shopify. Un producto con varias tallas requiere seleccionar o modelar cada variante adecuadamente; esta versión usa **una variante por ficha**.
5. En la web, abre `admin.html` → Gestión de productos → «ID de variante de Shopify». Pega la variante correspondiente y publica los cambios en GitHub.
6. En «Shopify · Centro comercial» verifica el dominio y, **solo cuando la tienda esté lista y se hayan probado pedidos**, habilita checkout y vuelve a publicar.
7. Comprueba que el enlace `/cart/ID:cantidad` abre Shopify con los productos, stock, impuestos y envíos correctos.

### Seguridad y límites

- La página de GitHub Pages no cobra ni almacena tarjetas, direcciones, datos de pedidos ni clientes.
- Los enlaces «Pedidos» y «Clientes» abren Shopify Admin, que requiere tu inicio de sesión.
- No pegues tokens de acceso privado de Shopify en la web ni en GitHub.
- Las rebajas y cupones locales no son promociones reales de Shopify; créalos por separado en Shopify Admin.
- La tienda pública contiene artículos, reseñas, existencias e importes de demostración hasta que los sustituyas por datos comprobados.
- Para suplementos deportivos, revisa la legislación española y europea sobre comercialización, etiquetado y declaraciones nutricionales o de salud.

Referencia oficial: https://help.shopify.com/es/manual/checkout-settings/cart-permalink