// =========================================================================
// ADAPTADOR AWS (Producción)
// =========================================================================
// Este archivo es el componente real que conecta tu Frontend con Amazon Web Services.
// Todo su funcionamiento depende estrictamente de que el equipo Backend haya 
// diseñado sus Lambdas tal cual como se estipuló en el archivo de Requisitos (Misión 3).

// 👇 ¡AQUÍ PEGARÁS LA URL DEL ENPOINT DEL API GATEWAY CUANDO TU EQUIPO LA TERMINE!
const API_URL = "https://URL-DE-TU-API-GATEWAY.execute-api.us-east-1.amazonaws.com/pedidos"; 

export const OrderAdapter = {
    
    // (1) POST: Petición para enviar la compra hacia DynamoDB (Apunta a Lambda createOrder)
    crearPedido: async (pedidoData) => {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pedidoData) 
                // El frontend envía: { cliente: "Juan", items: [...] }
            });
            const result = await response.json();
            return result; 
            // El Frontend asume que la Lambda devolverá: { status: "success", data: { ... } }
        } catch (error) {
            console.error("Fallo CATASTRÓFICO de red al crear pedido en AWS:", error);
            throw error;
        }
    },

    // (2) GET: Petición para descargar todos los pedidos (Apunta a Lambda getOrders)
    obtenerPedidos: async () => {
        try {
            const response = await fetch(API_URL, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            return result; 
            // El Frontend asume que la Lambda devolverá: { status: "success", data: [ ...array ] }
        } catch (error) {
            console.error("Fallo de descarga de DB en AWS:", error);
            throw error;
        }
    },

    // (3) PUT: Actualiza el Logístico (Apunta a Lambda updateOrder con SQS/SNS oculto)
    actualizarPedido: async (orderId, nuevoEstado) => {
        try {
            const response = await fetch(API_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, nuevoEstado })
            });
            const result = await response.json();
            return result; 
            // El Frontend asume que la Lambda devolverá: { status: "success" }
        } catch (error) {
            console.error("Fallo de mutación al actualizar pedido en AWS:", error);
            throw error;
        }
    }
};
