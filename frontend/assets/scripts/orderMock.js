// =========================================================================
// orderMock.js
// Adapter mock para desarrollo local sin AWS.
// Imita la API real (POST/GET/PATCH /orders) con setTimeout para realismo.
// =========================================================================

function nuevaFechaRelativa(minOffset) {
    const f = new Date();
    f.setMinutes(f.getMinutes() + minOffset);
    return f.toISOString();
}

function generarOrderId() {
    return 'ORD-' + Math.floor(1000 + Math.random() * 9000);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Estado en memoria. Seed inicial para que cocina/domiciliario tengan
// algo que ver al abrir las vistas la primera vez.
const dbPedidos = [
    {
        orderId: 'ORD-1152',
        cliente: 'Carolina Ríos',
        items: ['Hamburguesa Criolla', 'Limonada de Coco'],
        total: 33500,
        estado: 'En Camino',
        fecha: nuevaFechaRelativa(-12),
        riderId: 'r001',
        direccion: 'Calle 85 #12-43, Chapinero'
    },
    {
        orderId: 'ORD-9382',
        cliente: 'Camilo Forero',
        items: ['Bandeja Paisa', 'Aguapanela con Queso'],
        total: 32000,
        estado: 'En Cocina',
        fecha: nuevaFechaRelativa(-5),
        direccion: 'Carrera 11 #93-22, Chicó'
    },
    {
        orderId: 'ORD-7421',
        cliente: 'Mariana Torres',
        items: ['Arepa de Chócolo', 'Aguapanela con Queso'],
        total: 25500,
        estado: 'Listo',
        fecha: nuevaFechaRelativa(-22),
        direccion: 'Calle 72 #8-15, Quinta Camacho'
    },
    {
        orderId: 'ORD-3098',
        cliente: 'Andrés Vega',
        items: ['Salchipapa Salvaje', 'Chicha de Maíz'],
        total: 29500,
        estado: 'Recibido',
        fecha: nuevaFechaRelativa(-2),
        direccion: 'Diagonal 81 #7-20, Rosales'
    }
];

// Perfil del repartidor mock (en producción vendría de un endpoint /me)
export const RIDER_MOCK = {
    riderId: 'r001',
    name: 'Carlos Rodríguez',
    avatar: '🛵',
    rating: 4.8,
    totalDeliveries: 1247,
    online: true,
    todayStats: {
        deliveries: 8,
        earnings: 64000,
        hoursOnline: 5.2
    }
};

// =========================================================================
// OrderAdapter — interfaz compatible con orderAwsAdapter.js
// =========================================================================
export const OrderAdapter = {

    // ─────────── Productos (Etapa F) ───────────
    // Importamos perezosamente para no acoplar este archivo al catálogo:
    // el cliente puede llamar getProducts() y obtener la lista del mock.
    getProducts: async () => {
        await delay(150);
        const { PRODUCTS_MOCK } = await import('./productsMock.js');
        // Devolvemos los productos SIN imageUrl. En modo mock, la card
        // resuelve la imagen probando extensiones contra assets/img/.
        return [...PRODUCTS_MOCK];
    },

    getProduct: async (productId) => {
        await delay(100);
        const { PRODUCTS_MOCK } = await import('./productsMock.js');
        const p = PRODUCTS_MOCK.find(x => x.productId === productId);
        if (!p) throw new Error(`Producto ${productId} no encontrado`);
        return p;
    },

    // ─────────── Repartidores (Etapa F) ───────────
    getRider: async (riderId) => {
        await delay(120);
        if (riderId === RIDER_MOCK.riderId) {
            return { ...RIDER_MOCK };
        }
        throw new Error(`Rider ${riderId} no encontrado`);
    },

    // ─────────── Pedidos ───────────
    // POST /orders
    crearPedido: async (pedidoData) => {
        await delay(600);
        const nuevo = {
            orderId: generarOrderId(),
            cliente: pedidoData.cliente,
            items: pedidoData.items,
            total: pedidoData.totalPagadoOPCIONAL || 0,
            estado: 'Recibido',
            fecha: new Date().toISOString(),
            direccion: pedidoData.direccion || 'Sin dirección registrada'
        };
        dbPedidos.push(nuevo);
        return { status: 'success', data: nuevo };
    },

    // GET /orders
    obtenerPedidos: async () => {
        await delay(300);
        return { status: 'success', data: [...dbPedidos] };
    },

    // PATCH /orders/{orderId}
    actualizarPedido: async (orderId, nuevoEstado, opciones = {}) => {
        await delay(400);
        const pedido = dbPedidos.find(p => p.orderId === orderId);
        if (!pedido) {
            throw new Error(`Pedido ${orderId} no encontrado`);
        }
        pedido.estado = nuevoEstado;
        if (opciones.riderId) pedido.riderId = opciones.riderId;
        return { status: 'success', data: { ...pedido } };
    }
};
