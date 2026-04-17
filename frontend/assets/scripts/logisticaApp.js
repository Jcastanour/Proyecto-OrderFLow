import { api } from './config.js';

document.addEventListener('DOMContentLoaded', () => {

    // Contenedores UI (columnas)
    const colRecibido  = document.getElementById('columnaRecibido');
    const colCocina    = document.getElementById('columnaCocina');
    const colCamino    = document.getElementById('columnaCamino');
    const colEntregado = document.getElementById('columnaEntregado');

    // Contadores visuales UI
    const countRecibido  = document.getElementById('countRecibido');
    const countCocina    = document.getElementById('countCocina');
    const countCamino    = document.getElementById('countCamino');
    const countEntregado = document.getElementById('countEntregado');

    const btnRecargar = document.getElementById('btnRecargar');

    // Mapeo lógico de estados y los botones para avanzar
    const logicaTransicion = {
        'Recibido':  { siguienteEstado: 'En Cocina', textoBoton: '👨‍🍳 Pasar a cocina' },
        'En Cocina': { siguienteEstado: 'En Camino', textoBoton: '🛵 Enviar a domicilio' },
        'En Camino': { siguienteEstado: 'Entregado', textoBoton: '✅ Marcar entregado' },
        'Entregado': null
    };

    // Refresco manual
    btnRecargar.addEventListener('click', async () => {
        const texto = btnRecargar.textContent;
        btnRecargar.textContent = '⏱️ Actualizando…';
        btnRecargar.disabled = true;
        await cargarTableroKanban();
        btnRecargar.textContent = texto;
        btnRecargar.disabled = false;
    });

    // Handler global expuesto para los botones de ticket
    window.cambiarEstado = async (orderId, botonElement, nuevoEstado) => {
        try {
            botonElement.textContent = 'Guardando…';
            botonElement.disabled = true;

            await api.actualizarPedido(orderId, nuevoEstado);
            await cargarTableroKanban();
        } catch (error) {
            alert('Error salvando estado. Reintente.');
            console.error(error);
        }
    };

    async function cargarTableroKanban() {
        try {
            const response = await api.obtenerPedidos();
            const pedidos  = response.data;

            // Limpieza general de columnas
            colRecibido.innerHTML  = '';
            colCocina.innerHTML    = '';
            colCamino.innerHTML    = '';
            colEntregado.innerHTML = '';
            let cR = 0, cC = 0, cM = 0, cE = 0;

            [...pedidos].reverse().forEach(pedido => {
                const transicion = logicaTransicion[pedido.estado];
                const hora = new Date(pedido.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const botonHTML = transicion ? `
                    <button class="ticket__boton"
                            onclick="window.cambiarEstado('${pedido.orderId}', this, '${transicion.siguienteEstado}')">
                        ${transicion.textoBoton}
                    </button>` : '';

                const cardHTML = `
                    <article class="ticket" data-estado="${pedido.estado}">
                        <div class="ticket__fila">
                            <span class="ticket__id">${pedido.orderId}</span>
                            <span class="ticket__hora">${hora}</span>
                        </div>
                        <p class="ticket__cliente">🙋‍♂️ ${pedido.cliente}</p>
                        <p class="ticket__items">📦 ${pedido.items.join(', ')}</p>
                        ${botonHTML}
                    </article>
                `;

                if (pedido.estado === 'Recibido')        { colRecibido.innerHTML  += cardHTML; cR++; }
                else if (pedido.estado === 'En Cocina') { colCocina.innerHTML    += cardHTML; cC++; }
                else if (pedido.estado === 'En Camino') { colCamino.innerHTML    += cardHTML; cM++; }
                else if (pedido.estado === 'Entregado') { colEntregado.innerHTML += cardHTML; cE++; }
            });

            if (cR === 0) colRecibido.innerHTML  = '<p class="kanban-vacia">Sin pedidos nuevos</p>';
            if (cC === 0) colCocina.innerHTML    = '<p class="kanban-vacia">Cocina libre</p>';
            if (cM === 0) colCamino.innerHTML    = '<p class="kanban-vacia">Ningún motorizado en ruta</p>';
            if (cE === 0) colEntregado.innerHTML = '<p class="kanban-vacia">Aún no hay entregas</p>';

            countRecibido.textContent  = cR;
            countCocina.textContent    = cC;
            countCamino.textContent    = cM;
            countEntregado.textContent = cE;

        } catch (error) {
            console.error('Error leyendo DB (Mocks/AWS):', error);
        }
    }

    cargarTableroKanban();
});
