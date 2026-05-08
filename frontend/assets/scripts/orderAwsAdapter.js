// =========================================================================
// ADAPTADOR AWS (Producción)
// =========================================================================
// Traduce entre las claves que usa el frontend (cliente/estado/fecha)
// y las que devuelve la Lambda (customer/status/createdAt).
// La URL del API la lee de window.ENV.API_URL (inyectada en env.js).
// =========================================================================

const API_URL = (typeof window !== 'undefined' && window.ENV && window.ENV.API_URL) || '';

// ---- Traducción de claves ------------------------------------------------
function mapearDesdeAws(item) {
    if (!item) return item;
    return {
        orderId: item.orderId,
        cliente: item.customer,
        items:   item.items || [],
        estado:  item.status,
        fecha:   item.createdAt,
        total:   item.total ?? 0
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

    // POST /orders
    crearPedido: async (pedidoFront) => {
        const body = {
            customer: pedidoFront.cliente,
            items:    pedidoFront.items,
            total:    pedidoFront.totalPagadoOPCIONAL ?? 0
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
    actualizarPedido: async (orderId, nuevoEstado) => {
        const item = await pedirJson(`${API_URL}/orders/${orderId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: nuevoEstado })
        });
        return { status: 'success', data: mapearDesdeAws(item) };
    }
};
