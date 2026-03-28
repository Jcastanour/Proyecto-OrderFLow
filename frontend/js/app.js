import { api } from './config.js';

// Estado global simple (Memoria de UI)
let carrito = [];
let totalCarrito = 0;

// Utilidad internacional para formatear moneda a COP
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
    const cartItemsDiv = document.getElementById('cartItems');
    const cartTotalSpan = document.getElementById('cartTotal');
    const cartCountBadge = document.getElementById('cartCountBadge');

    cartCountBadge.textContent = carrito.length;
    document.getElementById('navCartCount').textContent = carrito.length;

    if (carrito.length === 0) {
        cartItemsDiv.innerHTML = '<p class="text-gray-400 text-sm italic py-2 text-center">Aún tienes hambre...</p>';
        cartTotalSpan.textContent = '$0 COP';
        return;
    }

    cartItemsDiv.innerHTML = ''; 

    carrito.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-0';
        row.innerHTML = `
            <div class="flex flex-col">
                <span class="text-gray-800 font-bold text-xs truncate max-w-[150px]">🥘 ${item.nombre}</span>
            </div>
            <span class="text-gray-500 font-mono font-medium">${formatoCOP.format(item.precio)}</span>
        `;
        cartItemsDiv.appendChild(row);
    });

    cartTotalSpan.textContent = formatoCOP.format(totalCarrito);
}

document.addEventListener('DOMContentLoaded', () => {
    
    const formPedido = document.getElementById('formPedido');
    const listaPedidos = document.getElementById('listaPedidos');
    const btnSubmit = document.getElementById('btnSubmit');
    const btnText = document.getElementById('btnText');

    cargarPedidosHaciaLogistica();
    actualizarUICarrito();

    formPedido.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if(carrito.length === 0) {
            alert("¡Epa parce! Tu carrito está vacío. Añade una bandejita o empandas primero 🌮.");
            return;
        }

        const nombre = document.getElementById('nombreInput').value;
        const nombreItemsMapeados = carrito.map(i => i.nombre); 

        btnText.textContent = 'Cobrando en Pesos...';
        btnSubmit.classList.add('opacity-50', 'cursor-not-allowed', 'animate-pulse');
        btnSubmit.disabled = true;

        try {
            await api.crearPedido({
                cliente: nombre,
                items: nombreItemsMapeados,
                totalPagadoOPCIONAL: totalCarrito // OPCIONAL: para registrarlo en BD (si se desea luego)
            });
            
            // Éxito
            carrito = [];
            totalCarrito = 0;
            actualizarUICarrito();
            formPedido.reset();
            
            await cargarPedidosHaciaLogistica(); 

        } catch (error) {
            alert('Lo sentimos, algo falló en tu pago.');
        } finally {
            btnText.textContent = 'Procesar Orden ➔';
            btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed', 'animate-pulse');
            btnSubmit.disabled = false;
        }
    });

    async function cargarPedidosHaciaLogistica() {
        try {
            const response = await api.obtenerPedidos();
            const pedidosLocal  = response.data;
            
            if (pedidosLocal.length === 0) {
                listaPedidos.innerHTML = '<p class="text-gray-500 text-sm italic">Tus domicilios recientes aparecerán aquí.</p>';
                return;
            }

            listaPedidos.innerHTML = ''; 
            
            const iteradorPedidos = [...pedidosLocal].reverse();
            iteradorPedidos.forEach(pedido => {
                const badgeColor = getStyleBadge(pedido.estado);
                
                const card = document.createElement('div');
                card.className = 'bg-gray-800 p-3 rounded-2xl border border-gray-700 hover:border-gray-600 transition';
                
                const resumenItems = pedido.items.join(', ');

                card.innerHTML = `
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-900 border ${badgeColor} uppercase tracking-wide shadow-sm">
                            ${pedido.estado}
                        </span>
                        <p class="text-[11px] text-gray-500 font-mono tracking-tighter">ID: ${pedido.orderId}</p>
                    </div>
                    <p class="font-bold text-gray-100 text-xs truncate">🙋‍♂️ ${pedido.cliente}</p>
                    <p class="text-[11px] text-gray-400 mt-0.5 truncate flex items-center gap-1">
                        <span>🛵</span> ${resumenItems}
                    </p>
                `;
                listaPedidos.appendChild(card);
            });

        } catch (error) {
            listaPedidos.innerHTML = '<p class="text-red-400 text-xs py-2">Fallo en la conexión radar.</p>';
        }
    }

    function getStyleBadge(estado) {
        switch(estado) {
            case 'Recibido': return 'text-blue-400 border-blue-900 shadow-blue-500/20';
            case 'En Cocina': return 'text-yellow-400 border-yellow-900 shadow-yellow-500/20';
            case 'En Camino': return 'text-orange-400 border-orange-900 shadow-orange-500/20';
            case 'Entregado': return 'text-green-400 border-green-900 shadow-green-500/20';
            default: return 'text-gray-400 border-gray-700';
        }
    }
});
