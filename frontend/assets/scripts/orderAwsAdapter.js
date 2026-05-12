// =========================================================================
// ADAPTADOR AWS (Producción)
// =========================================================================
// Traduce entre las claves que usa el frontend (cliente/estado/fecha)
// y las que devuelve la Lambda (customer/status/createdAt).
// La URL del API la lee de window.ENV.API_URL (inyectada en env.js).
// =========================================================================

const API_URL = (typeof window !== 'undefined' && window.ENV && window.ENV.API_URL) || '';

// ---- Traducción de claves ------------------------------------------------
// Frontend ←→ Backend
//   cliente     ↔ customer
//   estado      ↔ status
//   fecha       ↔ createdAt
//   direccion   = direccion (mismo nombre)
//   riderId     = riderId (mismo nombre)
function mapearDesdeAws(item) {
    if (!item) return item;
    return {
        orderId:   item.orderId,
        cliente:   item.customer,
        items:     item.items || [],
        estado:    item.status,
        fecha:     item.createdAt,
        total:     item.total ?? 0,
        direccion: item.direccion ?? 'Sin dirección registrada',
        riderId:   item.riderId ?? null
    };
}

function mapearListaDesdeAws(lista) {
    return (lista || []).map(mapearDesdeAws);
}

// ---- Helper fetch JSON ---------------------------------------------------
async function pedirJson(url, opciones = {}) {
    const respuesta = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opciones
    });
    if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status}`);
    }
    return respuesta.json();
}

// ---- API ----------------------------------------------------------------
export const OrderAdapter = {

    // ─────────── Productos (Etapa F) ───────────
    // GET /products
    // La Lambda devuelve cada producto enriquecido con imageUrl resuelto
    // (matching slug → bucket S3). El frontend usa imageUrl directamente.
    getProducts: async () => {
        const lista = await pedirJson(`${API_URL}/products`);
        return lista || [];
    },

    // GET /products/{productId}
    getProduct: async (productId) => {
        return pedirJson(`${API_URL}/products/${encodeURIComponent(productId)}`);
    },

    // ─────────── Repartidores (Etapa F) ───────────
    // GET /riders/{riderId}
    getRider: async (riderId) => {
        return pedirJson(`${API_URL}/riders/${encodeURIComponent(riderId)}`);
    },

    // ─────────── Pedidos ───────────
    // POST /orders
    crearPedido: async (pedidoFront) => {
        const body = {
            customer:  pedidoFront.cliente,
            items:     pedidoFront.items,
            total:     pedidoFront.totalPagadoOPCIONAL ?? 0,
            // Etapa A: enviar dirección al backend
            direccion: pedidoFront.direccion ?? undefined
        };
        const item = await pedirJson(`${API_URL}/orders`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        return { status: 'success', data: mapearDesdeAws(item) };
    },

    // GET /orders
    obtenerPedidos: async () => {
        const lista = await pedirJson(`${API_URL}/orders`);
        return { status: 'success', data: mapearListaDesdeAws(lista) };
    },

    // PATCH /orders/{orderId}
    // opciones (objeto opcional):
    //   { riderId: 'r001' } cuando el repartidor acepta o se actualiza la asignación.
    //   { direccion: '...' } si en algún momento se cambia la dirección.
    actualizarPedido: async (orderId, nuevoEstado, opciones = {}) => {
        const body = { status: nuevoEstado };

        // Etapa A: pasar campos opcionales al backend si vienen en opciones.
        if (opciones.riderId)   body.riderId   = opciones.riderId;
        if (opciones.direccion) body.direccion = opciones.direccion;

        const item = await pedirJson(`${API_URL}/orders/${orderId}`, {
            method: 'PATCH',
            body: JSON.stringify(body)
        });
        return { status: 'success', data: mapearDesdeAws(item) };
    }
};
