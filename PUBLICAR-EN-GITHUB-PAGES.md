# Publicar ALANTIS SPORT en GitHub Pages

El sitio ya usa rutas relativas (`styles.css`, `app.js`, `assets/`), así que funciona en una URL de proyecto de GitHub Pages, como `https://byl0ke.github.io/alantis-sport/`.

## Preparar el repositorio

1. Entra en https://github.com/new.
2. Propietario: `Byl0ke`; nombre: `alantis-sport`; visibilidad: **Public**.
3. Marca **Add a README file**, y pulsa **Create repository**.

## Subir la web

1. En el repositorio, pulsa **Add file > Upload files**.
2. Arrastra **todos los archivos y la carpeta `assets/`** de esta web, de modo que `index.html`, `styles.css` y `app.js` queden **en la raíz** del repositorio, no dentro de una carpeta `alantis-sport-web`.
3. Pulsa **Commit changes** en `main`.

## Activar Pages

1. Abre **Settings > Pages** del repositorio.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. En **Branch**, elige `main` y la carpeta `/ (root)`, y pulsa **Save**.
4. Tras el despliegue, la web debería aparecer en `https://byl0ke.github.io/alantis-sport/` (la URL solo funcionará una vez que GitHub Pages haya publicado el sitio).

## Comprobar

- Se ve el logo dorado y negro.
- Se muestran las imágenes de productos y el banner.
- El catálogo, los filtros, el buscador y el carrito se pueden utilizar.
- La versión móvil es correcta.

**Importante**: Es una demo de tienda estática, sin pagos ni gestión de pedidos reales. Los precios, productos y gastos de envío actuales son ilustrativos. Antes de vender, hay que conectar una solución comercial y completar datos legales y de contacto.

## Gestionar el catálogo sin editar código

Abre `https://byl0ke.github.io/alantis-sport/admin.html` para administrar productos, inventario, cupones, ofertas y banner. El panel actualiza `products.json` y `store-config.json`. Para guardar cambios en la web, crea un Fine-grained personal access token de GitHub restringido a este repositorio (permiso `Contents: Read and write`) y publica desde el panel. El token permanece únicamente en la memoria de esa pestaña; no lo compartas ni lo subas al repositorio.

También puedes usar `Guardar borrador`, exportar CSV, descargar copias completas e importar un respaldo sin conectar GitHub. Los cambios locales no se publican automáticamente.