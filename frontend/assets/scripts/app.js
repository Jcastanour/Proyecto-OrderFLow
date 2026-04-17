import { api } from './config.js';

// Estado global simple (memoria de UI)
let carrito = [];
let totalCarrito = 0;

// Formato moneda COP
const formatoCOP = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

window.agregarAlCarrito = (nombreItem, precioItem) => {
    carrito.push({ nombre: nombreItem, precio: precioItem });
    totalCarrito += precioItem;
    actualizarUICarrito();
};

function actualizarUICarrito() {
    const cartItemsDiv    = document.getElementById('cartItems');
    const cartTotalSpan   = document.getElementById('cartTotal');
    const cartCountBadge  = document.getElementById('cartCountBadge');
    const navCartCount    = document.getElementById('navCartCount');

    cartCountBadge.textContent = carrito.length;
    navCartCount.textContent   = carrito.length;

    if (carrito.length === 0) {
        cartItemsDiv.innerHTML = '<p class="carrito-vacio">Aún tienes hambre…</p>';
        cartTotalSpan.textContent = '$0';
        return;
    }

    cartItemsDiv.innerHTML = '';
    carrito.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'carrito-item';
        row.innerHTML = `
            <span class="carrito-item__nombre">🥘 ${item.nombre}</span>
            <span class="carrito-item__precio">${formatoCOP.format(item.precio)}</span>
        `;
        cartItemsDiv.appendChild(row);
    });

    cartTotalSpan.textContent = formatoCOP.format(totalCarrito);
}

document.addEventListener('DOMContentLoaded', () => {
    const formPedido   = document.getElementById('formPedido');
    const listaPedidos = document.getElementById('listaPedidos');
    const btnSubmit    = document.getElementById('btnSubmit');
    const btnText      = document.getElementById('btnText');

    cargarPedidosHaciaLogistica();
    actualizarUICarrito();

    formPedido.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (carrito.length === 0) {
            alert('¡Epa parce! Tu carrito está vacío. Añade una bandejita o empanadas primero 🌮.');
            return;
        }

        const nombre = document.getElementById('nombreInput').value;
        const nombreItemsMapeados = carrito.map(i => i.nombre);

        btnText.textContent = 'Cobrando…';
        btnSubmit.disabled = true;

        try {
            await api.crearPedido({
                cliente: nombre,
                items: nombreItemsMapeados,
                totalPagadoOPCIONAL: totalCarrito
            });

            carrito = [];
            totalCarrito = 0;
            actualizarUICarrito();
            formPedido.reset();

            await cargarPedidosHaciaLogistica();
        } catch (error) {
            alert('Lo sentimos, algo falló en tu pago.');
        } finally {
            btnText.textContent = 'Procesar orden';
            btnSubmit.disabled = false;
        }
    });

    async function cargarPedidosHaciaLogistica() {
        try {
            const response = await api.obtenerPedidos();
            const pedidosLocal = response.data;

            if (pedidosLocal.length === 0) {
                listaPedidos.innerHTML = '<p class="kanban-vacia" style="color:#6d6254;">Tus domicilios recientes aparecerán aquí.</p>';
                return;
            }

            listaPedidos.innerHTML = '';
            const iteradorPedidos = [...pedidosLocal].reverse();
            iteradorPedidos.forEach(pedido => {
                const claseEstado = estadoToClase(pedido.estado);
                const card = document.createElement('div');
                card.className = 'radar__card';
                const resumenItems = pedido.items.join(', ');

                card.innerHTML = `
                    <div class="radar__fila">
                        <span class="estado-badge ${claseEstado}">${pedido.estado}</span>
                        <span class="radar__id">${pedido.orderId}</span>
                    </div>
                    <p class="radar__cliente">🙋‍♂️ ${pedido.cliente}</p>
                    <p class="radar__items">🛵 ${resumenItems}</p>
                `;
                listaPedidos.appendChild(card);
            });
        } catch (error) {
            listaPedidos.innerHTML = '<p class="kanban-vacia" style="color:var(--salsa);">Fallo en la conexión radar.</p>';
        }
    }

    function estadoToClase(estado) {
        switch (estado) {
            case 'Recibido':  return 'estado-recibido';
            case 'En Cocina': return 'estado-cocina';
            case 'En Camino': return 'estado-camino';
            case 'Entregado': return 'estado-entregado';
            default: return '';
        }
    }
});
