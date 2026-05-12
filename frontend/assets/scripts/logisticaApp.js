// =========================================================================
// logisticaApp.js — Vista de cocina/admin (dashboard + kanban 3-col)
// =========================================================================

import { api } from './config.js';

const $ = (id) => document.getElementById(id);

const formatoCOP = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

// Mapeo: estado actual → siguiente estado + texto del botón
const TRANSICION = {
    'Recibido':  { siguiente: 'En Cocina', texto: '→ Pasar a cocina' },
    'En Cocina': { siguiente: 'Listo',     texto: '→ Marcar listo' },
    'Listo':     null  // listo = espera al repartidor; el repartidor lo pasa a En Camino
};

document.addEventListener('DOMContentLoaded', () => {
    inicializarFecha();

    $('btnRecargar').addEventListener('click', async () => {
        const txt = $('btnRecargar').textContent;
        $('btnRecargar').textContent = '⏱ Actualizando…';
        $('btnRecargar').disabled = true;
        await cargarTablero();
        $('btnRecargar').textContent = txt;
        $('btnRecargar').disabled = false;
    });

    // Handler global para los botones de los tickets
    window.cambiarEstado = async (orderId, btn, nuevoEstado) => {
        const original = btn.textContent;
        btn.textContent = '...';
        btn.disabled = true;
        try {
            await api.actualizarPedido(orderId, nuevoEstado);
            await cargarTablero();
        } catch (err) {
            console.error(err);
            btn.textContent = original;
            btn.disabled = false;
            alert('Error guardando estado. Reintente.');
        }
    };

    cargarTablero();
    setInterval(cargarTablero, 6000); // auto-refresh cada 6s
});

function inicializarFecha() {
    const hoy = new Date();
    const opciones = { weekday: 'short', day: '2-digit', month: 'short' };
    $('resumenFecha').textContent = hoy.toLocaleDateString('es-CO', opciones);
}

async function cargarTablero() {
    try {
        const respuesta = await api.obtenerPedidos();
        const pedidos = respuesta.data || [];

        const recibidos  = pedidos.filter(p => p.estado === 'Recibido');
        const enCocina   = pedidos.filter(p => p.estado === 'En Cocina');
        const listos     = pedidos.filter(p => p.estado === 'Listo');
        const enCamino   = pedidos.filter(p => p.estado === 'En Camino');
        const entregados = pedidos.filter(p => p.estado === 'Entregado');

        pintarColumna('columnaRecibido', recibidos);
        pintarColumna('columnaCocina', enCocina);
        pintarColumna('columnaListo', listos);

        $('countRecibido').textContent = recibidos.length;
        $('countCocina').textContent   = enCocina.length;
        $('countListo').textContent    = listos.length;

        // KPIs
        const totalHoy = pedidos.length;
        const enProceso = recibidos.length + enCocina.length + listos.length;
        const completados = entregados.length;
        const ingresos = pedidos.reduce((s, p) => s + (p.total || 0), 0);
        const ticket = totalHoy ? Math.round(ingresos / totalHoy) : 0;

        $('kpiPedidos').textContent = totalHoy;
        $('kpiProceso').textContent = enProceso;
        $('kpiCompletados').textContent = completados;
        $('kpiTicket').textContent = formatoCOP.format(ticket);

        $('resumenPedidos').textContent = totalHoy;
        $('resumenIngresos').textContent = formatoCOP.format(ingresos);

        // Historial
        pintarHistorial([...enCamino, ...entregados]);

    } catch (err) {
        console.error('Error cargando tablero:', err);
    }
}

function pintarColumna(idColumna, pedidos) {
    const col = $(idColumna);
    if (!col) return;
    col.innerHTML = '';
    if (pedidos.length === 0) {
        col.innerHTML = '<p class="kanban-vacia">— vacío —</p>';
        return;
    }
    pedidos
        .slice()
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        .forEach(p => col.appendChild(crearTicket(p)));
}

function crearTicket(pedido) {
    const ticket = document.createElement('article');
    ticket.className = 'ticket fade-in';
    ticket.dataset.estado = pedido.estado;

    const hora = new Date(pedido.fecha).toLocaleTimeString('es-CO', {
        hour: '2-digit', minute: '2-digit'
    });

    const trans = TRANSICION[pedido.estado];
    const botonHTML = trans
        ? `<button type="button" class="ticket__boton"
              onclick="window.cambiarEstado('${pedido.orderId}', this, '${trans.siguiente}')">
                ${trans.texto}
           </button>`
        : '<div style="font-size: 0.78rem; color: var(--tinta-3); text-align: center; padding: 4px;">⏳ esperando repartidor</div>';

    const items = (pedido.items || []).join(' · ');
    const total = pedido.total ? formatoCOP.format(pedido.total) : '';

    ticket.innerHTML = `
        <div class="ticket__fila">
            <span class="ticket__id">${pedido.orderId}</span>
            <span class="ticket__hora">${hora}</span>
        </div>
        <div class="ticket__cliente">${pedido.cliente}</div>
        <div class="ticket__items">${items}</div>
        ${total ? `<div class="ticket__total">${total}</div>` : ''}
        ${botonHTML}
    `;
    return ticket;
}

function pintarHistorial(pedidos) {
    const lista = $('historialLista');
    if (!lista) return;
    if (pedidos.length === 0) {
        lista.innerHTML = '<p style="text-align:center; color: var(--tinta-3); padding: 16px;">No hay entregas todavía hoy.</p>';
        return;
    }
    lista.innerHTML = '';
    pedidos
        .slice()
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .forEach(p => {
            const fila = document.createElement('div');
            fila.className = 'historial-fila';
            const claseEstado = p.estado === 'En Camino' ? 'historial-fila__estado--camino' : 'historial-fila__estado--entregado';
            const hora = new Date(p.fecha).toLocaleTimeString('es-CO', {
                hour: '2-digit', minute: '2-digit'
            });
            fila.innerHTML = `
                <span class="historial-fila__id">${p.orderId}</span>
                <span class="historial-fila__cliente">${p.cliente}</span>
                <span class="historial-fila__estado ${claseEstado}">${p.estado}</span>
                <span style="font-family: var(--fuente-mono); font-size: 0.78rem; color: var(--tinta-3);">${hora}</span>
            `;
            lista.appendChild(fila);
        });
}
