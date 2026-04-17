// =========================================================================
// OrderFlow · Configuración del frontend
// -------------------------------------------------------------------------
// Un único archivo para conmutar fuentes de datos y assets visuales
// entre modo local (mock) y modo AWS real. Cambiar UNA línea basta.
// =========================================================================

// ------- 1) Adaptador de datos (mock ↔ AWS) -------
//
// Cuando el backend AWS esté listo, cambiar la línea de abajo por:
//   import { OrderAdapter } from './orderAwsAdapter.js';
//
import { OrderAdapter } from './orderMock.js';

export const api = OrderAdapter;


// ------- 2) Base URL para imágenes/assets visuales -------
//
// Por defecto: imágenes servidas desde el mismo bucket/sitio estático.
// Cuando el equipo cree el bucket `orderflow-assets`, cambiar por:
//   export const ASSETS_BASE_URL = 'https://orderflow-assets.s3.amazonaws.com/';
//
export const ASSETS_BASE_URL = 'assets/img/';


// ------- 3) Resolver de imágenes (uso en HTML vía data-img) -------
//
// Cualquier <img data-img="bandeja-paisa.svg"> recibirá el src resuelto
// automáticamente al cargar la página. Esto deja el HTML declarativo
// y desacoplado del origen real.
//
export function resolverImagenes(raiz = document) {
    raiz.querySelectorAll('img[data-img]').forEach(img => {
        const nombre = img.dataset.img;
        if (!nombre) return;
        img.src = ASSETS_BASE_URL + nombre;
    });
}

// Auto-ejecución al cargar el DOM
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => resolverImagenes());
    } else {
        resolverImagenes();
    }
}
