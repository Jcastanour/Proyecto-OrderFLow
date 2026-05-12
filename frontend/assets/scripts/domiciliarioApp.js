// =========================================================================
// domiciliarioApp.js — Vista del repartidor (perfil + tabs + aceptar pedidos)
// =========================================================================

import { api } from './config.js';

const $ = (id) => document.getElementById(id);

const formatoCOP = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

// Etapa F: rider se carga del API (mock o AWS) al iniciar.
// Empieza con un placeholder mínimo para que la UI no quede vacía
// mientras llega la respuesta.
const RIDER_ID = 'r001';
let rider = {
    riderId: RIDER_ID,
    name: 'Cargando…',
    avatar: '🛵',
    rating: 0,
    totalDeliveries: 0,
    online: true,
    todayStats: { deliveries: 0, earnings: 0, hoursOnline: 0 }
};
let tabActiva = 'disponibles';

// ─── Comisión simulada por entrega (lo que gana el repartidor) ───
function calcularGanancia(pedido) {
    // 10% del ticket, mínimo $4.000, máximo $12.000.
    const base = Math.round((pedido.total || 0) * 0.1);
    return Math.min(Math.max(base, 4000), 12000);
}

// ─── Distancia simulada (no hay GPS real en este demo) ───
function distanciaSimulada(pedido) {
    // Determinístico desde el orderId para que sea estable entre refreshes
    const semilla = (pedido.orderId || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const km = ((semilla % 47) / 10 + 1.2).toFixed(1);
    return `${km} km`;
}

// ─── Toast ───
function mostrarToast(mensaje, tipo = '') {
    const toast = $('toast');
    toast.textContent = mensaje;
    toast.className = 'toast visible' + (tipo ? ' toast--' + tipo : '');
    setTimeout(() => toast.classList.remove('visible'), 2400);
}

// ─── Render del perfil ───
function renderPerfil() {
    $('riderAvatar').textContent = rider.avatar || '🛵';
    $('riderNombre').textContent = rider.name;
    $('riderRating').innerHTML = `${rider.rating.toFixed(1)} <span style="opacity:0.6;">·</span> ${rider.totalDeliveries.toLocaleString('es-CO')} entregas`;

    $('statEntregasHoy').textContent = rider.todayStats.deliveries;
    $('statGanancias').textContent = formatoCOP.format(rider.todayStats.earnings);
    $('statHoras').textContent = `${rider.todayStats.hoursOnline.toFixed(1)}h`;
}

// ─── Cargar y dispatchar pedidos ───
async function cargar() {
    try {
        const respuesta = await api.obtenerPedidos();
        const pedidos = respuesta.data || [];

        // Disponibles: estado "Listo" sin riderId asignado
        const disponibles = pedidos.filter(p => p.estado === 'Listo' && !p.riderId);

        // Mis entregas: estado "En Camino" del repartidor actual
        const misEntregas = pedidos.filter(p => p.estado === 'En Camino' && p.riderId === rider.riderId);

        // Historial: entregados por mí
        const historial = pedidos.filter(p => p.estado === 'Entregado' && p.riderId === rider.riderId);

        $('conteoDisponibles').textContent = disponibles.length;
        $('conteoMisEntregas').textContent = misEntregas.length;
        $('conteoHistorial').textContent = historial.length;

        pintarDisponibles(disponibles);
        pintarMisEntregas(misEntregas);
        pintarHistorial(historial);

    } catch (err) {
        console.error('Error cargando pedidos:', err);
    }
}

// ─── Render: pedidos disponibles ───
function pintarDisponibles(pedidos) {
    const lista = $('listaDisponibles');
    lista.innerHTML = '';
    if (pedidos.length === 0) {
        lista.innerHTML = `
            <div class="lista-vacia">
                <span class="emoji">🪺</span>
                <p>No hay pedidos disponibles ahora.<br><span style="opacity:0.7; font-weight: 400;">Llegarán pronto.</span></p>
            </div>
        `;
        return;
    }
    pedidos.forEach(p => lista.appendChild(crearCardDisponible(p)));
}

function crearCardDisponible(pedido) {
    const card = document.createElement('article');
    card.className = 'pedido-disponible fade-in';
    const ganancia = calcularGanancia(pedido);
    const distancia = distanciaSimulada(pedido);
    const items = (pedido.items || []).join(' · ');

    card.innerHTML = `
        <div class="pedido-disponible__head">
            <span class="pedido-disponible__id">${pedido.orderId}</span>
            <span class="pedido-disponible__ganancia">+${formatoCOP.format(ganancia)}</span>
        </div>
        <div class="pedido-disponible__cliente">${pedido.cliente}</div>
        <div class="pedido-disponible__direccion">${pedido.direccion || 'Dirección no disponible'}</div>
        <div class="pedido-disponible__items">${items}</div>
        <div class="pedido-disponible__pie">
            <span class="pedido-disponible__distancia">📍 ${distancia}</span>
            <button type="button" class="pedido-disponible__btn" data-action="aceptar" data-id="${pedido.orderId}">
                Aceptar entrega
            </button>
        </div>
    `;

    card.querySelector('[data-action="aceptar"]').addEventListener('click', () => aceptarPedido(pedido));
    return card;
}

async function aceptarPedido(pedido) {
    try {
        await api.actualizarPedido(pedido.orderId, 'En Camino', { riderId: rider.riderId });
        mostrarToast(`Aceptaste ${pedido.orderId}`, 'exito');
        // Saltamos a la tab "Mis entregas" para que vea el pedido tomado
        cambiarTab('mis-entregas');
        await cargar();
    } catch (err) {
        console.error(err);
        mostrarToast('No se pudo aceptar', 'error');
    }
}

// ─── Render: mis entregas en curso ───
function pintarMisEntregas(pedidos) {
    const lista = $('listaMisEntregas');
    lista.innerHTML = '';
    if (pedidos.length === 0) {
        lista.innerHTML = `
            <div class="lista-vacia">
                <span class="emoji">📦</span>
                <p>No tienes entregas en curso.<br><span style="opacity:0.7; font-weight: 400;">Toma una de "Disponibles".</span></p>
            </div>
        `;
        return;
    }
    pedidos.forEach(p => {
        const card = crearCardEnCurso(p);
        lista.appendChild(card);
    });
}

function crearCardEnCurso(pedido) {
    const card = document.createElement('article');
    card.className = 'pedido-disponible fade-in';
    const ganancia = calcularGanancia(pedido);
    const items = (pedido.items || []).join(' · ');

    card.innerHTML = `
        <div class="pedido-disponible__head">
            <span class="pedido-disponible__id">${pedido.orderId}</span>
            <span class="pedido-disponible__ganancia">+${formatoCOP.format(ganancia)}</span>
        </div>
        <div class="pedido-disponible__cliente">${pedido.cliente}</div>
        <div class="pedido-disponible__direccion">${pedido.direccion || 'Dirección no disponible'}</div>
        <div class="pedido-disponible__items">${items}</div>
        <div class="pedido-disponible__pie">
            <span class="pedido-disponible__distancia">🛵 En ruta</span>
            <button type="button" class="pedido-disponible__btn pedido-disponible__btn--secundario" data-id="${pedido.orderId}">
                ✓ Marcar entregado
            </button>
        </div>
    `;

    card.querySelector('button').addEventListener('click', () => marcarEntregado(pedido));
    return card;
}

async function marcarEntregado(pedido) {
    try {
        await api.actualizarPedido(pedido.orderId, 'Entregado');
        const ganancia = calcularGanancia(pedido);
        rider.todayStats.deliveries += 1;
        rider.todayStats.earnings += ganancia;
        renderPerfil();
        mostrarToast(`Entregado · +${formatoCOP.format(ganancia)}`, 'exito');
        await cargar();
    } catch (err) {
        console.error(err);
        mostrarToast('No se pudo marcar entregado', 'error');
    }
}

// ─── Render: historial ───
function pintarHistorial(pedidos) {
    const lista = $('listaHistorial');
    lista.innerHTML = '';
    if (pedidos.length === 0) {
        lista.innerHTML = `
            <div class="lista-vacia">
                <span class="emoji">📜</span>
                <p>Sin entregas completadas todavía hoy.</p>
            </div>
        `;
        return;
    }
    pedidos
        .slice()
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .forEach(p => {
            const card = document.createElement('article');
            card.className = 'pedido-disponible';
            card.style.opacity = '0.85';
            const ganancia = calcularGanancia(p);
            const hora = new Date(p.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
            card.innerHTML = `
                <div class="pedido-disponible__head">
                    <span class="pedido-disponible__id">${p.orderId}</span>
                    <span class="pedido-disponible__ganancia">+${formatoCOP.format(ganancia)}</span>
                </div>
                <div class="pedido-disponible__cliente">${p.cliente}</div>
                <div class="pedido-disponible__direccion">${p.direccion || ''}</div>
                <div class="pedido-disponible__pie">
                    <span class="pedido-disponible__distancia">🕒 ${hora}</span>
                    <span style="font-size: 0.78rem; padding: 4px 10px; border-radius: 999px; background: var(--cilantro-suave); color: var(--cilantro); font-weight: 700;">Entregado</span>
                </div>
            `;
            lista.appendChild(card);
        });
}

// ─── Cambio de tabs ───
function cambiarTab(tab) {
    tabActiva = tab;
    document.querySelectorAll('.rider-tabs__btn').forEach(b => {
        b.classList.toggle('activo', b.dataset.tab === tab);
    });
    document.querySelectorAll('.bottom-nav__item').forEach(b => {
        b.classList.toggle('activo', b.dataset.bottomTab === tab);
    });
    $('tabDisponibles').style.display  = tab === 'disponibles'  ? '' : 'none';
    $('tabMisEntregas').style.display  = tab === 'mis-entregas' ? '' : 'none';
    $('tabHistorial').style.display    = tab === 'historial'    ? '' : 'none';
}

// ─── Inicialización ───
// Carga el perfil del rider del API (mock o AWS) y refresca la UI.
async function cargarRider() {
    try {
        const data = await api.getRider(RIDER_ID);
        // Mergeamos para no perder defaults si el backend devuelve campos
        // faltantes (ej: todayStats no inicializado en seed).
        rider = {
            ...rider,
            ...data,
            todayStats: { ...rider.todayStats, ...(data.todayStats || {}) }
        };
    } catch (err) {
        console.error('No se pudo cargar el rider:', err);
        rider.name = 'Repartidor';
    }
    renderPerfil();
}

document.addEventListener('DOMContentLoaded', () => {
    renderPerfil();   // pinta placeholder mientras llega la API
    cargarRider();    // carga datos reales del rider
    cargar();         // pedidos disponibles / en curso / historial

    // Tabs (header)
    document.querySelectorAll('.rider-tabs__btn').forEach(btn => {
        btn.addEventListener('click', () => cambiarTab(btn.dataset.tab));
    });
    // Bottom nav (móvil) — espeja las mismas tabs
    document.querySelectorAll('.bottom-nav__item').forEach(btn => {
        btn.addEventListener('click', () => cambiarTab(btn.dataset.bottomTab));
    });

    // Toggle online/off
    $('btnOnline').addEventListener('click', () => {
        rider.online = !rider.online;
        const btn = $('btnOnline');
        if (rider.online) {
            btn.textContent = 'En línea';
            btn.style.background = 'rgba(22, 163, 74, 0.18)';
            btn.style.borderColor = 'var(--cilantro)';
            btn.style.color = 'var(--cilantro)';
        } else {
            btn.textContent = 'Off';
            btn.style.background = 'rgba(220, 38, 38, 0.18)';
            btn.style.borderColor = 'var(--salsa)';
            btn.style.color = 'var(--salsa)';
        }
    });

    // Auto-refresh
    setInterval(cargar, 6000);
});
