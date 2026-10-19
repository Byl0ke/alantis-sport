# ALANTIS SPORT — Web de tienda online (demo)

Proyecto de tienda deportiva inspirado en el diseño de referencia negro y dorado. **Es una web estática interactiva de demostración, no una tienda con pagos reales.**

## Cómo verla

1. Descomprime `alantis-sport-web.zip`.
2. Abre `index.html` en Chrome, Edge o Firefox.
3. También puedes subir esta carpeta entera a cualquier hosting estático (GitHub Pages, Netlify, Vercel).

## Funciones incluidas

- Diseño responsive para ordenador, tablet y móvil, estilo oro y negro.
- Logotipo del guerrero y favicon propios.
- Banner principal, colecciones, catálogo ilustrado, promociones y pie de página.
- Filtros por categorías, buscador y ordenación.
- Productos editables con precios en euros, botón de compra y favoritos.
- Carrito con cantidades, eliminación, cálculo de envío **ilustrativo** y cupón de ejemplo `ALANTIS10`.
- Carrito y favoritos se recuerdan en este navegador mediante `localStorage`.
- Ventanas informativas y formulario visual de newsletter (sin recogida de datos).

## Modificar productos

Abre `app.js` y modifica el array `PRODUCTS` al principio del archivo. Cada producto incluye: `id`, `name`, `category`, `price`, `reviews`, `image` y `rating`. Puedes añadir más fotografías a la carpeta `assets/` y referenciarlas desde ese array. Los productos, opiniones, precios, ofertas y estimaciones de envío actuales son **ejemplos, no artículos reales a la venta**.

## Antes de vender de verdad

1. Integrar la web en una plataforma de venta (Shopify / WooCommerce) y sustituir el carrito demo por pedidos y stock reales.
2. Configurar pasarela de pago, envío, IVA, facturación, dominio y políticas legales.
3. Reemplazar fotos y precios ficticios por los de productos realmente disponibles y autorizados.
4. Incorporar razón social, formas de contacto y enlaces oficiales a redes sociales.
5. Integrar newsletter solo después de configurar un proveedor, consentimiento y política de privacidad.
6. Verificar específicamente el etiquetado, información obligatoria y alegaciones permitidas para vitaminas y suplementos alimenticios destinados al mercado español/UE.

Los recursos visuales de demostración proceden de la imagen de referencia facilitada por el usuario y del logotipo diseñado para este proyecto. Las imágenes de productos son ilustrativas. La web utiliza Google Fonts cuando hay conexión; se mantienen fuentes alternativas sin internet.