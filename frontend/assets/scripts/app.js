// =========================================================================
// app.js — Vista cliente (carta + carrito + tracker)
// =========================================================================

import { api, crearImagenProducto } from './config.js';
import { CATEGORIAS } from './productsMock.js';

// ═══════════════ Estado global UI ═══════════════
let productos = [];                      // catálogo cargado del API (Etapa F)
let productosTendencias = [];            // top 6 por rating
let carrito = [];                       // array de {productId, name, price, quantity}
let categoriaActiva = 'todos';
let busquedaActiva = '';
let modalProductId = null;
let modalCantidad = 1;
let pollingTimers = new Map();           // orderId -> intervalId

// ═══════════════ Estado global Auth ═══════════════
let authModoRegistro = false;
let authModoConfirmacion = false;
let loggedInUser = null;
const COGNITO_URL = 'https://cognito-idp.us-east-1.amazonaws.com/';

// ═══════════════ Helpers sobre el catálogo cargado ═══════════════
function getProductById(productId) {
    return productos.find(p => p.productId === productId);
}

function getProductsByCategory(categoryId) {
    if (categoryId === 'todos') return productos;
    return productos.filter(p => p.category === categoryId);
}

function searchProducts(query) {
    if (!query) return productos;
    const q = query.toLowerCase().trim();
    return productos.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.tags || []).some(t => (t || '').toLowerCase().includes(q))
    );
}

// Persistir carrito en localStorage para que aguante refresh
function guardarCarrito() {
    try { localStorage.setItem('orderflow_cart', JSON.stringify(carrito)); }
    catch (e) { /* silencioso */ }
}
function cargarCarrito() {
    try {
        const data = localStorage.getItem('orderflow_cart');
        if (data) carrito = JSON.parse(data);
    } catch (e) { carrito = []; }
}

// ═══════════════ Helpers ═══════════════
const formatoCOP = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

const $ = (id) => document.getElementById(id);

function calcularTotal() {
    return carrito.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function calcularConteo() {
    return carrito.reduce((sum, item) => sum + item.quantity, 0);
}

function estadoToClase(estado) {
    switch (estado) {
        case 'Recibido':  return 'estado-recibido';
        case 'En Cocina': return 'estado-cocina';
        case 'Listo':     return 'estado-cocina';
        case 'En Camino': return 'estado-camino';
        case 'Entregado': return 'estado-entregado';
        default:          return '';
    }
}

function estadoAIndice(estado) {
    const orden = ['Recibido', 'En Cocina', 'En Camino', 'Entregado'];
    // 'Listo' lo tratamos visualmente como En Cocina (cocina terminó, esperando rider)
    if (estado === 'Listo') return 1;
    return orden.indexOf(estado);
}

// ═══════════════ Toast ═══════════════
function mostrarToast(mensaje, tipo = '') {
    const toast = $('toast');
    toast.textContent = mensaje;
    toast.className = 'toast visible' + (tipo ? ' toast--' + tipo : '');
    setTimeout(() => toast.classList.remove('visible'), 2400);
}

// ═══════════════ Render: categorías ═══════════════
function renderCategorias() {
    const cont = $('categoriasContainer');
    cont.innerHTML = '';
    CATEGORIAS.forEach(cat => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'categoria-pill' + (cat.id === categoriaActiva ? ' activa' : '');
        pill.innerHTML = `<span class="emoji">${cat.emoji}</span><span>${cat.nombre}</span>`;
        pill.addEventListener('click', () => {
            categoriaActiva = cat.id;
            renderCategorias();
            renderCatalogo();
        });
        cont.appendChild(pill);
    });
}

// ═══════════════ Render: card de plato ═══════════════
function crearPlatoCard(producto, esTendencia = false) {
    const card = document.createElement('article');
    card.className = 'plato-card';
    card.tabIndex = 0;
    card.dataset.productId = producto.productId;

    // El contenedor de la foto se llena por `crearImagenProducto` con cascade
    // png → jpg → svg → webp → emoji (modo mock) o usa imageUrl (modo AWS).
    const ratingTxt = (typeof producto.rating === 'number' ? producto.rating : 0).toFixed(1);

    card.innerHTML = `
        <div class="plato-card__foto">
            <div class="plato-card__rating">${ratingTxt}</div>
            <div class="plato-card__media"></div>
        </div>
        <div class="plato-card__cuerpo">
            <div class="plato-card__nombre">${producto.name}</div>
            <p class="plato-card__desc">${producto.description || ''}</p>
            <div class="plato-card__pie">
                <div class="plato-card__precio">
                    <span class="currency">$</span>${(producto.price || 0).toLocaleString('es-CO')}
                </div>
                <button type="button" class="btn-add" aria-label="Agregar ${producto.name}">+</button>
            </div>
        </div>
    `;

    // Resolver imagen con cascade de extensiones / fallback emoji
    const mediaContainer = card.querySelector('.plato-card__media');
    const fotoWrap = card.querySelector('.plato-card__foto');
    crearImagenProducto(producto, mediaContainer, () => {
        // Si no hay imagen, marcamos el wrapper como placeholder para que CSS lo estilice
        fotoWrap.classList.add('plato-card__foto--placeholder');
    });

    // Click en la card abre modal; click en el botón + agrega directo
    const btnAdd = card.querySelector('.btn-add');
    btnAdd.addEventListener('click', (e) => {
        e.stopPropagation();
        agregarProducto(producto, 1);
    });
    card.addEventListener('click', () => abrirModal(producto.productId));

    return card;
}

// ═══════════════ Render: tendencias ═══════════════
function renderTendencias() {
    const cont = $('contenedorTendencias');
    cont.innerHTML = '';
    productosTendencias.forEach(p => cont.appendChild(crearPlatoCard(p, true)));
}

// ═══════════════ Render: catálogo principal ═══════════════
function renderCatalogo() {
    const grid = $('catalogoGrid');
    let lista = busquedaActiva
        ? searchProducts(busquedaActiva)
        : getProductsByCategory(categoriaActiva);

    // Aplicar filtros combinados (categoría + búsqueda)
    if (busquedaActiva && categoriaActiva !== 'todos') {
        lista = lista.filter(p => p.category === categoriaActiva);
    }

    grid.innerHTML = '';
    if (lista.length === 0) {
        grid.innerHTML = `<div class="lista-vacia" style="grid-column: 1 / -1;">
            <span class="emoji">🤷</span>
            <p>No encontramos platos con ese filtro</p>
        </div>`;
    } else {
        lista.forEach(p => grid.appendChild(crearPlatoCard(p)));
    }

    // Actualizar título y contador
    const cat = CATEGORIAS.find(c => c.id === categoriaActiva);
    $('tituloCatalogo').textContent = busquedaActiva
        ? `Resultados para "${busquedaActiva}"`
        : (cat?.id === 'todos' ? 'Toda la carta' : cat?.nombre || 'Carta');
    $('contadorPlatos').textContent = `${lista.length} ${lista.length === 1 ? 'plato' : 'platos'}`;

    // Ocultar sección tendencias si hay búsqueda activa
    $('seccionTendencias').style.display = busquedaActiva ? 'none' : '';
}

// ═══════════════ Carrito ═══════════════
function agregarProducto(producto, cantidad = 1) {
    const existente = carrito.find(i => i.productId === producto.productId);
    if (existente) {
        existente.quantity += cantidad;
    } else {
        carrito.push({
            productId: producto.productId,
            name: producto.name,
            price: producto.price,
            quantity: cantidad
        });
    }
    guardarCarrito();
    renderCarrito();
    mostrarToast(`Agregado: ${producto.name}`, 'exito');
}

function quitarProducto(productId) {
    carrito = carrito.filter(i => i.productId !== productId);
    guardarCarrito();
    renderCarrito();
}

function vaciarCarrito() {
    carrito = [];
    guardarCarrito();
    renderCarrito();
}

function renderCarrito() {
    const conteo = calcularConteo();
    const total = calcularTotal();

    // Badge global (header)
    $('navCartCount').textContent = conteo;
    $('navCartCount').style.display = conteo > 0 ? 'inline-block' : 'none';

    // Modal único (compartido entre móvil y desktop)
    const items = $('cartItems');
    const countBadge = $('cartCountBadge');
    const subtotalEl = $('cartSubtotal');
    const totalEl = $('cartTotal');

    countBadge.textContent = `${conteo} ${conteo === 1 ? 'ítem' : 'ítems'}`;

    if (carrito.length === 0) {
        items.innerHTML = `
            <div class="carrito-vacio">
                <span class="emoji">🍽️</span>
                Tu carrito está vacío
            </div>
        `;
        subtotalEl.textContent = '$0';
        totalEl.textContent = '$0';
        return;
    }

    items.innerHTML = '';
    carrito.forEach(item => {
        const fila = document.createElement('div');
        fila.className = 'carrito-item';
        fila.innerHTML = `
            <span class="carrito-item__nombre">${item.quantity}× ${item.name}</span>
            <span class="carrito-item__precio">${formatoCOP.format(item.price * item.quantity)}</span>
        `;
        items.appendChild(fila);
    });
    subtotalEl.textContent = formatoCOP.format(total);
    totalEl.textContent = formatoCOP.format(total);
}

// ═══════════════ Modal de detalle ═══════════════
function abrirModal(productId) {
    const p = getProductById(productId);
    if (!p) return;
    modalProductId = productId;
    modalCantidad = 1;

    $('modalTitulo').textContent = p.name;
    $('modalDesc').textContent = p.description;
    $('modalRating').innerHTML = `${p.rating.toFixed(1)} <span class="punto">·</span> ${p.prepMinutes} min de preparación`;
    $('modalPrecio').innerHTML = `<span class="currency">$</span>${p.price.toLocaleString('es-CO')}`;
    $('modalCantidad').textContent = '1';
    $('modalTags').innerHTML = p.tags.map(t => `<span class="tag-chip">${t}</span>`).join('');

    // Imagen del modal: misma lógica de cascade de extensiones que las cards.
    // En modo AWS, p.imageUrl viene del backend. En mock, prueba assets/img/{slug}.{ext}.
    const fotoEl = $('modalFoto');
    fotoEl.innerHTML = '';
    crearImagenProducto(p, fotoEl, () => {
        fotoEl.innerHTML = `<div class="emoji-grande">${p.emoji || '🍽️'}</div>`;
    });

    $('modalOverlay').classList.add('abierto');
    document.body.style.overflow = 'hidden';
}

function cerrarModal() {
    $('modalOverlay').classList.remove('abierto');
    document.body.style.overflow = '';
    modalProductId = null;
}

// ═══════════════ Modal del carrito ═══════════════
function abrirCarrito() {
    $('carritoOverlay').classList.add('abierto');
    $('carritoModal').classList.add('abierto');
    document.body.style.overflow = 'hidden';
}
function cerrarCarrito() {
    $('carritoOverlay').classList.remove('abierto');
    $('carritoModal').classList.remove('abierto');
    document.body.style.overflow = '';
}

// ═══════════════ Pedidos / tracker ═══════════════
async function cargarMisPedidos() {
    if (!loggedInUser) {
        $('misPedidos').style.display = 'none';
        if ($('navMisPedidos')) $('navMisPedidos').style.display = 'none';
        return;
    }
    if ($('navMisPedidos')) $('navMisPedidos').style.display = 'inline-block';

    try {
        const respuesta = await api.obtenerMisPedidos(loggedInUser.email);
        const pedidos = respuesta.data || [];
        // Mostrar pedidos recientes del usuario actual
        const recientes = pedidos
            .slice()
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 10);
        pintarMisPedidos(recientes);
    } catch (e) {
        console.error(e);
    }
}

function pintarMisPedidos(pedidos) {
    const seccion = $('misPedidos');
    const lista = $('listaPedidos');
    if (!pedidos || pedidos.length === 0) {
        seccion.style.display = 'none';
        return;
    }
    seccion.style.display = '';
    lista.innerHTML = '';
    pedidos.forEach(p => lista.appendChild(crearTracker(p)));
}

function crearTracker(pedido) {
    const card = document.createElement('div');
    card.className = 'tracker fade-in';
    const idxActual = estadoAIndice(pedido.estado);
    const pasos = ['Recibido', 'En cocina', 'En camino', 'Entregado'];

    let pasosHTML = '';
    pasos.forEach((nombre, i) => {
        const claseEstado =
            i < idxActual ? 'tracker__paso--completado' :
            i === idxActual ? 'tracker__paso--activo' : '';
        const icono = i < idxActual ? '✓' : (i + 1);
        pasosHTML += `
            <div class="tracker__paso ${claseEstado}">
                <div class="tracker__bola">${icono}</div>
                <div class="tracker__paso-label">${nombre}</div>
            </div>
        `;
        if (i < pasos.length - 1) {
            const lineaCompletada = i < idxActual ? 'tracker__linea--completada' : '';
            pasosHTML += `<div class="tracker__linea ${lineaCompletada}"></div>`;
        }
    });

    card.innerHTML = `
        <div class="tracker__header">
            <div class="tracker__cliente">${pedido.cliente}</div>
            <div class="tracker__id">${pedido.orderId}</div>
        </div>
        <div class="tracker__items">${(pedido.items || []).join(' · ')}</div>
        <div class="tracker__pasos">${pasosHTML}</div>
    `;
    return card;
}

// Polling ligero del estado de un pedido específico
function iniciarPollingPedido(orderId) {
    if (pollingTimers.has(orderId)) return;
    const intervalo = setInterval(cargarMisPedidos, 5000);
    pollingTimers.set(orderId, intervalo);
}

// ═══════════════ Submit del pedido ═══════════════
async function procesarPedido(formNombre, formDireccion, btnSubmit, btnTextEl) {
    if (carrito.length === 0) {
        mostrarToast('Tu carrito está vacío', 'error');
        return;
    }

    const nombreVal = formNombre.value.trim();
    const direccionVal = formDireccion.value.trim() || 'Sin dirección registrada';

    if (!nombreVal) {
        mostrarToast('Escribe tu nombre', 'error');
        formNombre.focus();
        return;
    }

    const nombresItems = carrito.flatMap(i => Array(i.quantity).fill(i.name));
    const total = calcularTotal();

    if (!loggedInUser) {
        mostrarToast('Debes iniciar sesión para hacer un pedido', 'error');
        abrirAuth();
        return;
    }

    if (btnTextEl) btnTextEl.textContent = 'Procesando…';
    btnSubmit.disabled = true;

    try {
        const respuesta = await api.crearPedido({
            cliente: nombreVal,
            items: nombresItems,
            totalPagadoOPCIONAL: total,
            direccion: direccionVal,
            userEmail: loggedInUser.email
        });
        vaciarCarrito();
        formNombre.value = '';
        formDireccion.value = '';
        mostrarToast('Pedido confirmado · ' + respuesta.data.orderId, 'exito');
        cerrarCarrito();
        await cargarMisPedidos();
        iniciarPollingPedido(respuesta.data.orderId);
        $('misPedidos').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        console.error(err);
        mostrarToast('No pudimos procesar tu pedido', 'error');
    } finally {
        if (btnTextEl) btnTextEl.textContent = 'Pedir ahora';
        btnSubmit.disabled = false;
    }
}

// ═══════════════ Auth ═══════════════
function abrirAuth() {
    $('authOverlay').classList.add('abierto');
    document.body.style.overflow = 'hidden';
}

function cerrarAuth() {
    $('authOverlay').classList.remove('abierto');
    document.body.style.overflow = '';
}

async function procesarAuth(e) {
    e.preventDefault();
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const btn = $('authBtnSubmit');
    const prevText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    const clientId = (window.ENV && window.ENV.CLIENT_ID) || '';

    try {
        if (!clientId) {
            // MODO MOCK LOCAL
            if (authModoRegistro) {
                mostrarToast('Cuenta creada localmente (Mock). Iniciando...', 'exito');
                authModoRegistro = false;
            }
            const nameField = $('authName');
            loggedInUser = {
                email: email,
                name: (nameField && nameField.value.trim()) || email.split('@')[0],
                token: 'mock-jwt-token-123'
            };
            localStorage.setItem('orderflow_user', JSON.stringify(loggedInUser));
            actualizarUIAuth();
            cerrarAuth();
            mostrarToast('¡Hola, ' + loggedInUser.name + ' (Mock)!', 'exito');
            cargarMisPedidos();
            return;
        }

        if (authModoConfirmacion) {
            const code = $('authCode').value.trim();
            const payload = {
                ClientId: clientId,
                Username: email,
                ConfirmationCode: code
            };
            const res = await fetch(COGNITO_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmSignUp' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error verificando el código');
            
            mostrarToast('Cuenta verificada con éxito. Iniciando...', 'exito');
            authModoConfirmacion = false;
            authModoRegistro = false;
            $('authCode').value = '';
            $('authCodeField').style.display = 'none';
            $('authCode').required = false;
            // No hacemos return para que continúe e inicie sesión automáticamente
            
        } else if (authModoRegistro) {
            const name = $('authName').value.trim();
            const payload = {
                ClientId: clientId,
                Username: email,
                Password: password,
                UserAttributes: [{ Name: 'email', Value: email }, { Name: 'name', Value: name }]
            };
            const res = await fetch(COGNITO_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error registrando usuario');
            
            mostrarToast('Revisa tu correo y digita el código.', 'exito');
            
            authModoConfirmacion = true;
            $('authTitulo').textContent = 'Verificar correo';
            $('authBtnSubmit').textContent = 'Confirmar código';
            $('authNameField').style.display = 'none';
            $('authCodeField').style.display = 'block';
            $('authCode').required = true;
            return;
        }

        const payload = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: clientId,
            AuthParameters: { USERNAME: email, PASSWORD: password }
        };
        const res = await fetch(COGNITO_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            if (data.message === 'User is not confirmed.' || data.__type === 'UserNotConfirmedException') {
                authModoConfirmacion = true;
                $('authTitulo').textContent = 'Verificar correo';
                $('authBtnSubmit').textContent = 'Confirmar código';
                $('authNameField').style.display = 'none';
                $('authCodeField').style.display = 'block';
                $('authCode').required = true;
                mostrarToast('Debes verificar tu correo primero.', 'error');
                return;
            }
            throw new Error(data.message || 'Credenciales inválidas');
        }

        const idToken = data.AuthenticationResult.IdToken;
        const payloadDecoded = JSON.parse(atob(idToken.split('.')[1]));
        
        loggedInUser = {
            email: payloadDecoded.email || email,
            name: payloadDecoded.name || email.split('@')[0],
            token: idToken
        };
        localStorage.setItem('orderflow_user', JSON.stringify(loggedInUser));
        
        actualizarUIAuth();
        cerrarAuth();
        mostrarToast('¡Hola, ' + loggedInUser.name + '!', 'exito');
        cargarMisPedidos();
    } catch (err) {
        mostrarToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = prevText;
    }
}

function actualizarUIAuth() {
    if (loggedInUser) {
        if ($('navLogin')) $('navLogin').style.display = 'none';
        if ($('navUser')) {
            $('navUser').style.display = 'inline-block';
            $('navUser').textContent = loggedInUser.name;
        }
        if ($('navLogout')) $('navLogout').style.display = 'inline-block';
        if ($('nombreInput')) $('nombreInput').value = loggedInUser.name;
    } else {
        if ($('navLogin')) $('navLogin').style.display = 'inline-block';
        if ($('navUser')) $('navUser').style.display = 'none';
        if ($('navLogout')) $('navLogout').style.display = 'none';
        if ($('nombreInput')) $('nombreInput').value = '';
    }
}

function initAuth() {
    try {
        const stored = localStorage.getItem('orderflow_user');
        if (stored) loggedInUser = JSON.parse(stored);
    } catch(e) {}
    
    actualizarUIAuth();

    if ($('navLogin')) {
        $('navLogin').addEventListener('click', (e) => {
            e.preventDefault();
            abrirAuth();
        });
    }

    if ($('navLogout')) {
        $('navLogout').addEventListener('click', (e) => {
            e.preventDefault();
            loggedInUser = null;
            localStorage.removeItem('orderflow_user');
            actualizarUIAuth();
            cargarMisPedidos();
            mostrarToast('Sesión cerrada');
            abrirAuth(); // Forzar login otra vez
        });
    }

    if ($('cerrarAuth')) $('cerrarAuth').addEventListener('click', cerrarAuth);
    if ($('authOverlay')) {
        $('authOverlay').addEventListener('click', (e) => {
            if (e.target === $('authOverlay')) cerrarAuth();
        });
    }

    if ($('authToggleMode')) {
        $('authToggleMode').addEventListener('click', (e) => {
            e.preventDefault();
            authModoConfirmacion = false;
            authModoRegistro = !authModoRegistro;
            $('authTitulo').textContent = authModoRegistro ? 'Crear cuenta' : 'Ingresar';
            $('authBtnSubmit').textContent = authModoRegistro ? 'Registrarme' : 'Ingresar';
            $('authToggleMode').textContent = authModoRegistro ? '¿Ya tienes cuenta? Ingresa' : '¿No tienes cuenta? Regístrate';
            
            if ($('authNameField')) $('authNameField').style.display = authModoRegistro ? 'block' : 'none';
            if ($('authName')) $('authName').required = authModoRegistro;
            
            if ($('authCodeField')) $('authCodeField').style.display = 'none';
            if ($('authCode')) $('authCode').required = false;
        });
    }

    if ($('authForm')) $('authForm').addEventListener('submit', procesarAuth);
    
    // Si no está logueado, forzar apertura del modal de login al cargar
    if (!loggedInUser) {
        abrirAuth();
    }
}

// ═══════════════ Inicialización ═══════════════
// Carga el catálogo del API (o mock si no hay URL) y dispara los renders.
async function cargarCatalogo() {
    try {
        productos = await api.getProducts();
        // Tendencias: top 6 por rating (mismo criterio que tenía PRODUCTS_TENDENCIAS)
        productosTendencias = [...productos]
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 6);
    } catch (err) {
        console.error('No se pudo cargar el catálogo:', err);
        productos = [];
        productosTendencias = [];
        mostrarToast('No pudimos cargar la carta', 'error');
    }
    renderTendencias();
    renderCatalogo();
}

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    cargarCarrito();
    renderCategorias();
    renderCarrito();

    // El catálogo es async (viene del API o del mock). Mientras carga,
    // las secciones quedan vacías; al resolverse, renderTendencias y
    // renderCatalogo se ejecutan.
    cargarCatalogo();

    cargarMisPedidos();

    // Búsqueda
    let searchTimeout;
    $('inputBusqueda').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            busquedaActiva = e.target.value.trim();
            renderCatalogo();
        }, 180);
    });

    // Modal
    $('cerrarModal').addEventListener('click', cerrarModal);
    $('modalOverlay').addEventListener('click', (e) => {
        if (e.target === $('modalOverlay')) cerrarModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModal();
            cerrarCarrito();
        }
    });

    $('modalIncremento').addEventListener('click', () => {
        modalCantidad = Math.min(modalCantidad + 1, 99);
        $('modalCantidad').textContent = modalCantidad;
    });
    $('modalDecremento').addEventListener('click', () => {
        modalCantidad = Math.max(modalCantidad - 1, 1);
        $('modalCantidad').textContent = modalCantidad;
    });
    $('modalAgregar').addEventListener('click', () => {
        if (!modalProductId) return;
        const p = getProductById(modalProductId);
        agregarProducto(p, modalCantidad);
        cerrarModal();
    });

    // Modal del carrito
    $('btnAbrirCarrito').addEventListener('click', abrirCarrito);
    $('cerrarCarrito').addEventListener('click', cerrarCarrito);
    $('carritoOverlay').addEventListener('click', cerrarCarrito);

    // Submit del pedido
    $('formPedido').addEventListener('submit', (e) => {
        e.preventDefault();
        procesarPedido($('nombreInput'), $('direccionInput'), $('btnSubmit'), $('btnText'));
    });

    // Bottom nav (móvil): solo intercepta los botones (Inicio, Pedidos);
    // los <a> (Nosotros) navegan normalmente.
    document.querySelectorAll('.bottom-nav__item').forEach(btn => {
        if (btn.tagName !== 'BUTTON') return;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.bottom-nav__item').forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
            const tab = btn.dataset.tab;
            if (tab === 'pedidos') {
                $('misPedidos').scrollIntoView({ behavior: 'smooth' });
            } else if (tab === 'inicio') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });

    // Nav desktop "Mis pedidos"
    $('navMisPedidos')?.addEventListener('click', (e) => {
        e.preventDefault();
        $('misPedidos').scrollIntoView({ behavior: 'smooth' });
    });

    // Compatibilidad: handler global usado por código antiguo
    window.agregarAlCarrito = (nombreItem, precioItem) => {
        const p = PRODUCTS_MOCK.find(x => x.name === nombreItem)
            || { productId: nombreItem, name: nombreItem, price: precioItem };
        agregarProducto(p, 1);
    };

    // Polling general cada 8s para mantener trackers vivos
    setInterval(cargarMisPedidos, 8000);
});
