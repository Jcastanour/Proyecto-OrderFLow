import { api } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // Contenedores UI (Columnas)
    const colRecibido = document.getElementById('columnaRecibido');
    const colCocina = document.getElementById('columnaCocina');
    const colCamino = document.getElementById('columnaCamino');
    const colEntregado = document.getElementById('columnaEntregado');
    
    // Contadores visuales UI
    const countRecibido = document.getElementById('countRecibido');
    const countCocina = document.getElementById('countCocina');
    const countCamino = document.getElementById('countCamino');
    const countEntregado = document.getElementById('countEntregado');

    const btnRecargar = document.getElementById('btnRecargar');

    // Mapeo lógico de estados y los botones para avanzar
    const logicaTransicion = {
        'Recibido': { 
            siguienteEstado: 'En Cocina', 
            textoBoton: '👨‍🍳 Pasar a Cocina',
            colorBoton: 'bg-yellow-600 hover:bg-yellow-500'
        },
        'En Cocina': { 
            siguienteEstado: 'En Camino', 
            textoBoton: '🛵 Enviar a Domicilio',
            colorBoton: 'bg-orange-600 hover:bg-orange-500'
        },
        'En Camino': { 
            siguienteEstado: 'Entregado', 
            textoBoton: '✅ Marcar Entregado',
            colorBoton: 'bg-green-600 hover:bg-green-500'
        },
        'Entregado': null // Estado final.
    };

    // Refresco Manual / Sincronización
    btnRecargar.addEventListener('click', async () => {
        btnRecargar.textContent = '⏱️ Actualizando...';
        await cargarTableroKanban();
        btnRecargar.textContent = '🔄 Refrescar Tablero';
    });

    // Exponemos la función global para que sea disparada por los botones HTML de las tarjetas
    window.cambiarEstado = async (orderId, botonElement, nuevoEstado) => {
        try {
            // Feedback UI inmediato en el botón oprimido (UX Logistics)
            botonElement.textContent = "Guardando...";
            botonElement.classList.add('opacity-50', 'animate-pulse');
            botonElement.disabled = true;

            // Llamada al adaptador AWS / Mocks a traves de Inyección limpia
            await api.actualizarPedido(orderId, nuevoEstado);
            
            // Recarga automática de todo el tablero para reflejar que la tarjeta se movió
            await cargarTableroKanban(); 
            
        } catch (error) {
            alert('Error salvando estado. Reintente.');
            console.error(error);
        }
    };

    async function cargarTableroKanban() {
        try {
            const response = await api.obtenerPedidos();
            const pedidos = response.data;
            
            // Limpieza general de Pantalla Kanban
            colRecibido.innerHTML = ''; colCocina.innerHTML = ''; 
            colCamino.innerHTML = ''; colEntregado.innerHTML = '';
            let cR = 0, cC = 0, cM = 0, cE = 0; // Variables conteo temporal

            // Reverse param os pedidos mas nuevos arriba
            [...pedidos].reverse().forEach(pedido => {
                const transicion = logicaTransicion[pedido.estado];
                
                // Inyectamos el Javascript onClick puro. 
                // Le pasamos `this` para poder modificar el botón a estado "cargando" sin afectar el resto de la interfaz.
                const botonHTML = transicion ? 
                    `<button onclick="window.cambiarEstado('${pedido.orderId}', this, '${transicion.siguienteEstado}')" 
                        class="w-full mt-3 text-white font-bold py-2 rounded-lg text-sm transition shadow ${transicion.colorBoton}">
                        ${transicion.textoBoton}
                    </button>` : '';

                const cardHTML = `
                    <div class="bg-gray-700 p-4 rounded-xl shadow-md border border-gray-600 hover:border-gray-500 transition relative">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-xs font-mono text-gray-400">ID: ${pedido.orderId}</span>
                            <span class="text-[10px] text-gray-500 bg-gray-800 px-1 rounded">${new Date(pedido.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p class="font-bold text-gray-100 text-base mb-1 truncate">🙋‍♂️ ${pedido.cliente}</p>
                        <p class="text-xs text-gray-400 bg-gray-900 border border-gray-800 p-2 rounded-lg truncate">📦 ${pedido.items.join(', ')}</p>
                        ${botonHTML}
                    </div>
                `;

                // Apendamos en su columna respectiva basada en String Matching del DB
                if(pedido.estado === 'Recibido') { colRecibido.innerHTML += cardHTML; cR++; }
                else if(pedido.estado === 'En Cocina') { colCocina.innerHTML += cardHTML; cC++; }
                else if(pedido.estado === 'En Camino') { colCamino.innerHTML += cardHTML; cM++; }
                else if(pedido.estado === 'Entregado') { colEntregado.innerHTML += cardHTML; cE++; }
            });

            // Asignación de Badge Counts Superiores
            countRecibido.textContent = cR;
            countCocina.textContent = cC;
            countCamino.textContent = cM;
            countEntregado.textContent = cE;

        } catch (error) {
            console.error("Error leyendo DB (Mocks/AWS):", error);
        }
    }

    // Arranque inicial automático (Load Event)
    cargarTableroKanban();
});
