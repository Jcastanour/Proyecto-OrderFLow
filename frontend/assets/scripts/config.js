// =========================================================================
// OrderFlow · Configuración del frontend
// -------------------------------------------------------------------------
// Decide qué adaptador de datos usar (MOCK local vs AWS real).
// La decisión se basa en si window.ENV.API_URL tiene valor.
// =========================================================================

import { OrderAdapter as MockAdapter } from './orderMock.js';
import { OrderAdapter as AwsAdapter } from './orderAwsAdapter.js';

const apiUrl = (typeof window !== 'undefined' && window.ENV && window.ENV.API_URL) || '';

// Si hay URL → producción (AWS). Si no → mock local.
export const api = apiUrl ? AwsAdapter : MockAdapter;

if (apiUrl) {
    console.info('[OrderFlow] Modo AWS activo. API:', apiUrl);
} else {
    console.info('[OrderFlow] Modo MOCK local. Define window.ENV.API_URL para usar AWS.');
}


// ------- Base URL para imágenes/assets visuales --------------------------
export const ASSETS_BASE_URL = 'assets/img/';

// Compat con código viejo (nosotros.html aún usa data-img).
// Resuelve cualquier <img data-img="archivo.svg"> → src = assets/img/archivo.svg.
export function resolverImagenes(raiz = document) {
    raiz.querySelectorAll('img[data-img]').forEach(img => {
        const nombre = img.dataset.img;
        if (!nombre) return;
        img.src = ASSETS_BASE_URL + nombre;
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => resolverImagenes());
    } else {
        resolverImagenes();
    }
}

// =========================================================================
// Resolución dinámica de imagen de producto (Etapa F)
// =========================================================================

/**
 * Convierte "Ajiaco Santafereño" → "ajiaco-santafereno".
 * Misma lógica que la Lambda products_handler para que el matching coincida.
 */
export function slugify(nombre) {
    if (!nombre) return '';
    return nombre
        .normalize('NFKD')                  // descomponer acentos
        .replace(/[̀-ͯ]/g, '')    // quitar marcas (tildes)
        .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')        // no-alfanum → guion
        .replace(/^-+|-+$/g, '');           // limpiar guiones de los extremos
}

/**
 * Crea un <img> que intenta cargar `assets/img/{slug}.{ext}` en cascada
 * probando png → jpg → svg → webp. Si todas fallan, ejecuta `onMissing()`
 * para que el caller renderice el emoji u otro fallback.
 *
 * Uso (en app.js):
 *   const wrapper = document.createElement('div');
 *   crearImagenProducto(producto, wrapper);
 *
 * En modo AWS, el producto ya trae `imageUrl` resuelto por la Lambda →
 * se usa ese src directamente sin cascade.
 */
export function crearImagenProducto(producto, contenedor, onMissing) {
    const fallbackEmoji = () => {
        contenedor.innerHTML = `<div class="emoji">${producto.emoji || '🍽️'}</div>`;
        if (typeof onMissing === 'function') onMissing();
    };

    // Modo AWS: el producto trae imageUrl ya resuelto por la Lambda
    if (producto.imageUrl) {
        const img = new Image();
        img.alt = producto.name || '';
        img.loading = 'lazy';
        img.onerror = fallbackEmoji;
        img.src = producto.imageUrl;
        contenedor.innerHTML = '';
        contenedor.appendChild(img);
        return;
    }

    // Modo mock local: probar extensiones en cascada
    const slug = slugify(producto.name);
    if (!slug) { fallbackEmoji(); return; }

    const extensiones = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
    let idx = 0;

    const img = new Image();
    img.alt = producto.name || '';
    img.loading = 'lazy';
    img.onerror = () => {
        idx += 1;
        if (idx >= extensiones.length) {
            fallbackEmoji();
            return;
        }
        img.src = `${ASSETS_BASE_URL}${slug}.${extensiones[idx]}`;
    };
    img.src = `${ASSETS_BASE_URL}${slug}.${extensiones[0]}`;

    contenedor.innerHTML = '';
    contenedor.appendChild(img);
}
