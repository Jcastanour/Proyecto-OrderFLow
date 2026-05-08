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
