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

## Panel de administración de catálogo

Una vez publicada en GitHub Pages, abre **https://byl0ke.github.io/alantis-sport/admin.html**.

- Cambia nombre, precio, precio anterior, categoría, descripción, unidades, imagen, visibilidad y destacado.
- Añade, duplica o elimina artículos. El editor muestra una vista previa.
- **Guardar borrador:** conserva una copia local en ese navegador, sin cambiar la web. Puedes descargar una copia `products.json`.
- **Publicar en GitHub:** necesitarás crear un token temporal de GitHub, seleccionar **solo** `Byl0ke/alantis-sport` y asignar **Contents: Read and write**. Pégalo en el panel, comprueba el acceso y pulsa Publicar. El token solo reside en la memoria de la pestaña (no se guarda en localStorage ni en el repositorio). Cierra la pestaña al terminar y revoca el token cuando ya no sea necesario.
- Al publicar, el panel actualiza `products.json` en la rama `main`. Si has seleccionado una fotografía local, se optimiza y se sube al repositorio en `assets/catalog/`. El despliegue de Pages suele tardar un poco en reflejar el cambio.

> **Seguridad importante:** `admin.html` es una página pública y **no dispone de un acceso privado**. La protección de los cambios la proporciona GitHub y el permiso del token. No compartas el token ni lo guardes en la web. Para un sistema con usuarios y contraseñas hace falta un servicio autenticado o una plataforma ecommerce.

El catálogo usado por la tienda se carga de `products.json`; si se abre localmente sin servidor, usa un catálogo de reserva definido en `app.js`. No cambies manualmente el array de reserva para publicar productos.

Los productos, reseñas, precios, ofertas y existencias actuales son **datos ilustrativos**. El stock no se descuenta en compras: la tienda no tiene checkout real.

## Antes de vender de verdad

1. Integrar la web en una plataforma de venta (Shopify / WooCommerce) y sustituir el carrito demo por pedidos y stock reales.
2. Configurar pasarela de pago, envío, IVA, facturación, dominio y políticas legales.
3. Reemplazar fotos y precios ficticios por los de productos realmente disponibles y autorizados.
4. Incorporar razón social, formas de contacto y enlaces oficiales a redes sociales.
5. Integrar newsletter solo después de configurar un proveedor, consentimiento y política de privacidad.
6. Verificar específicamente el etiquetado, información obligatoria y alegaciones permitidas para vitaminas y suplementos alimenticios destinados al mercado español/UE.

Los recursos visuales de demostración proceden de la imagen de referencia facilitada por el usuario y del logotipo diseñado para este proyecto. Las imágenes de productos son ilustrativas. La web utiliza Google Fonts cuando hay conexión; se mantienen fuentes alternativas sin internet.