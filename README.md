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

## Integración Shopify · preparado para cobros reales

- Shopify conectado: **`psm7b6-qs.myshopify.com`**, España, EUR. A fecha de esta versión, se ha comprobado que el plan está en **trial** y **no hay productos reales** en Shopify.
- La tienda alojada en GitHub Pages es solo el escaparate. El panel `admin.html` incluye **Shopify · Centro comercial** con enlaces a **Productos, Pedidos, Clientes, Descuentos y Pagos** dentro de Shopify Admin.
- Para asociar un producto de esta web con el producto real, crea primero el producto (y su variante) en Shopify y copia su **ID numérico de variante** al campo correspondiente de `admin.html`.
- Al seleccionar **Habilitar el botón que envía el carrito a Shopify** y publicar los cambios, el checkout irá a la URL de carrito alojada por Shopify (`https://{shop}.myshopify.com/cart/{variantId}:{quantity},...`) *solo si todos los artículos del carrito tienen variante*.
- **Por seguridad el checkout viene deshabilitado** (`store-config.json → commerce.checkoutEnabled: false`). No se activa automáticamente por editar productos ni por configurar un dominio.
- **Los precios, envío, stock y cupones de GitHub son ilustrativos** y NO se sincronizan con Shopify. Shopify establece los importes definitivos, valida existencias y procesa pagos. No se remiten tokens, correos o tarjetas desde GitHub Pages. Los descuentos del editor demo **no** crean descuentos en Shopify.
- Los productos de demostración, en particular suplementos, NO se deben publicar para cobro sin proveedores, stock, fotos y etiquetado reales, validación legal y configuración de impuestos y envíos.
- El editor de GitHub Pages **no es un panel privado**: su URL es pública. Los datos de pedidos y clientes únicamente están disponibles desde el panel autenticado de Shopify.

### Pasos para lanzar ventas reales

1. Seleccionar un plan de pago en Shopify y verificar la cuenta; después configurar la pasarela en Shopify Admin → Configuración → Pagos.
2. Añadir productos reales con fotos, descripciones verificadas, variantes, precios y stock a Shopify; publicarlos en el canal Online Store.
3. Configurar envíos, impuestos, devoluciones y avisos legales para España y la UE. Si vendes vitaminas o suplementos, verificar composición, etiquetado, condiciones y declaraciones permitidas.
4. Copiar los IDs de variante a `admin.html` y publicar el catálogo en GitHub.
5. Hacer un **pedido de prueba** en Shopify con su función de pruebas (con un plan compatible), comparar precios finales y confirmar que llega al panel Pedidos.
6. Solo entonces activar el checkout desde `admin.html` y publicar `store-config.json`.

Más información oficial: https://help.shopify.com/es/manual/checkout-settings/cart-permalink


## Panel unificado con PIN (acceso visual)

- Dirección del editor: `https://byl0ke.github.io/alantis-sport/admin.html`.
- Muestra una pantalla para introducir el PIN de seis dígitos facilitado por el propietario. Una sesión desbloqueada dura hasta cerrar la pestaña o pulsar «Bloquear».
- Todas las opciones están en la **misma página**: resumen, productos, inventario, cupones, banners, envíos, integración Shopify, copias de seguridad y publicación en GitHub.
- **Advertencia de seguridad**: el PIN del navegador NO protege los archivos del servidor, ni el catálogo, ni el código público. En GitHub Pages no existe autenticación privada ni backend; el hash del PIN también está publicado y un atacante puede saltar esta comprobación. No almacenar secretos ni datos personales en esos archivos.
- Para modificar o publicar el repositorio es obligatorio disponer de credenciales de GitHub con permisos. Para acceso privado real, implementar un servidor con autenticación y sesiones o utilizar el panel de Shopify, cuyo inicio de sesión ya está protegido.

## Pedidos y registros cifrados · nueva integración (pendiente de activar)

Se ha añadido una sección en `admin.html` para conectar un **servidor privado** y consultar pedidos, registros de eventos y descargar un `pedidos.sql.enc` cifrado. El código de backend se encuentra en `backend/`, implementa AES-256-GCM sobre exportación SQL SQLite, verifica los webhooks de Shopify con HMAC y exige token administrativo separado del PIN visual.

**Estado:** los archivos están preparados, pero el servidor **no se ha desplegado** y los webhooks **no se han conectado**. GitHub Pages no guarda pedidos: no afirmar que ya se están archivando pedidos reales. Para instrucciones de despliegue, secretos y copias consulta [GUIA-REGISTROS-SQL.md](GUIA-REGISTROS-SQL.md).