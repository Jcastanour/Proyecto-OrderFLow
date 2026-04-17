// Simula nuestra base de datos en memoria (DynamoDB falsa)
// Empieza con estos dos datos artificiales vacíos para que las vistas no se inicien vacías y el evaluador vea tu progreso.
let dbPedidos = [
    {
        orderId: "ORD-9382",
        cliente: "Camilo",
        items: ["Pizza Margherita"],
        estado: 'En Cocina',
        fecha: new Date(Date.now() - 1000 * 60 * 5).toISOString() // Hace 5 minutos
    },
    {
        orderId: "ORD-1152",
        cliente: "Carolina",
        items: ["Hamburguesa Wagyu", "Alitas BBQ"],
        estado: 'En Camino',
        fecha: new Date(Date.now() - 1000 * 60 * 30).toISOString() // Hace 30 minutos
    }
];

export const OrderAdapter = {
    // POST /pedidos
    crearPedido: async (pedidoData) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const nuevoPedido = {
                    orderId: "ORD-" + Math.floor(Math.random() * 10000), 
                    ...pedidoData,
                    estado: 'Recibido',
                    fecha: new Date().toISOString()
                };
                
                dbPedidos.push(nuevoPedido);
                resolve({ status: 'success', data: nuevoPedido });
            }, 800); // 800ms de latencia simulada
        });
    },

    // GET /pedidos
    obtenerPedidos: async () => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ status: 'success', data: dbPedidos });
            }, 400); // 400ms de latencia
        });
    },

    // PUT /pedidos/{id} (FASE 2 LOGISTICA)
    actualizarPedido: async (orderId, nuevoEstado) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const indice = dbPedidos.findIndex(p => p.orderId === orderId);
                
                if (indice !== -1) {
                    dbPedidos[indice].estado = nuevoEstado; // Aplicar Mutación en BD
                    resolve({ status: 'success', data: dbPedidos[indice] });
                } else {
                    reject({ status: 'error', message: 'Pedido no encontrado para actualizar en base simulada' });
                }
            }, 600); // Simulación de escritura lenta (600ms) a AWS
        });
    }
};
