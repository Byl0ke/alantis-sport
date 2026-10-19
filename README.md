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
- Carrito con cantidades, eliminación, envío **ilustrativo** configurable y cupones definidos en `store-config.json`.
- Carrito y favoritos se recuerdan en este navegador mediante `localStorage`.
- Ventanas informativas y formulario visual de newsletter (sin recogida de datos).

## Centro de administración (v2)

Abre **https://byl0ke.github.io/alantis-sport/admin.html** una vez desplegada la web.

### Productos e inventario

- Añadir, duplicar, editar, ocultar y eliminar productos. Editar precio, precio anterior, SKU, categoría, descripción, stock, fotografía y destacados.
- Buscar y filtrar por categoría, visibilidad, stock bajo, productos agotados y ofertas.
- Selección múltiple para mostrar/ocultar, destacar, aplicar rebajas porcentuales, quitar ofertas y borrar varios productos a la vez.
- Estadísticas **solo del catálogo**: artículos, productos visibles, agotados, rebajados, stock bajo y valor aproximado del inventario a precio de venta. **No representan ventas ni ingresos.**
- Exportar el inventario en CSV, descargar `products.json` e importar copias validadas.

### Ofertas y marketing

- Crear, editar, desactivar y eliminar códigos de descuento con valor fijo o porcentual, compra mínima y fechas de vigencia.
- Editar el banner promocional (título, subtítulo, CTA, mostrar u ocultar).
- Cambiar umbral de envío gratis, tarifa de envío y aviso de stock bajo.
- Los cambios del panel se guardan en `products.json` y `store-config.json`; la tienda lee ambos.
- **Estos cupones son solo de demostración y su definición es pública**. Para cobrar pedidos reales, los descuentos se deben validar en un backend/plataforma de pagos.

### Guardar, restaurar y publicar

1. Puedes pulsar **Guardar borrador** (datos locales del navegador), descargar un JSON completo con productos y promociones, o importar una copia para recuperar contenido.
2. Para publicar en GitHub, crea un **Fine-grained personal access token** limitado solo a `Byl0ke/alantis-sport`, permiso **Contents: Read and write**. Nunca lo copies en archivos de la tienda.
3. Introduce el token en el panel y pulsa **Comprobar acceso** y luego **Publicar todos los cambios**. GitHub recibe commits para `products.json`, `store-config.json` y cualquier foto nueva.
4. El token permanece en memoria de la pestaña y se descarta al cerrarla. **Revócalo cuando ya no lo necesites.**
5. La publicación de productos y configuración requiere **dos commits consecutivos**. Si falla el segundo, el panel avisará de publicación parcial: revisa GitHub antes de reintentar.

Las fotografías locales seleccionadas y todavía no publicadas no se incluyen en el borrador JSON. Exporta también tus fotos originales si necesitas mantener una copia.

> **Seguridad importante:** `admin.html` es una página pública y **no dispone de un acceso privado**. La protección de los cambios la proporciona GitHub y el permiso del token. No compartas el token ni lo guardes en la web. Para un sistema con usuarios y contraseñas hace falta un servicio autenticado o una plataforma ecommerce.

El catálogo usado por la tienda se carga de `products.json` y las promociones de `store-config.json`; si se abre localmente sin servidor, usa un catálogo de reserva definido en `app.js`. No cambies manualmente el array de reserva para publicar productos.

Los productos, reseñas, precios, ofertas y existencias actuales son **datos ilustrativos**. El stock no se descuenta en compras: la tienda no tiene checkout real.

## Antes de vender de verdad

1. Integrar la web en una plataforma de venta (Shopify / WooCommerce) y sustituir el carrito demo por pedidos y stock reales.
2. Configurar pasarela de pago, envío, IVA, facturación, dominio y políticas legales.
3. Reemplazar fotos y precios ficticios por los de productos realmente disponibles y autorizados.
4. Incorporar razón social, formas de contacto y enlaces oficiales a redes sociales.
5. Integrar newsletter solo después de configurar un proveedor, consentimiento y política de privacidad.
6. Verificar específicamente el etiquetado, información obligatoria y alegaciones permitidas para vitaminas y suplementos alimenticios destinados al mercado español/UE.

Los recursos visuales de demostración proceden de la imagen de referencia facilitada por el usuario y del logotipo diseñado para este proyecto. Las imágenes de productos son ilustrativas. La web utiliza Google Fonts cuando hay conexión; se mantienen fuentes alternativas sin internet.