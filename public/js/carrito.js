// ========== MOBILE MENU TOGGLE ==========
// Delegado a Header.astro (window.toggleMobileMenu / window.closeMobileMenu)
// que incluye overlay, body scroll lock, y botón X de cerrar

// Carrito de compras - localStorage + Supabase sync

// Usar window.carrito como referencia global - sincronizar desde localStorage
if (!window.carrito) {
    const carritoLocal = JSON.parse(localStorage.getItem('carrito') || '[]');
    window.carrito = carritoLocal;
    console.log('[carrito.js init] window.carrito sincronizado desde localStorage:', carritoLocal.length, 'items');
} else {
    // Si window.carrito ya existe, asegurar que localStorage también lo tenga
    localStorage.setItem('carrito', JSON.stringify(window.carrito));
}

// Referencia local para facilitar acceso
let carrito = window.carrito;
let descuentoAplicado = 0;

// ========== SISTEMA DE EXPIRACIÓN DE RESERVA DE STOCK (15 MINUTOS) ==========
// Evitar redeclaración de constantes
if (!window.EXPIRACION_CARRITO_MS_LOADED) {
    window.EXPIRACION_CARRITO_MS = 15 * 60 * 1000; // 15 minutos
    window.EXPIRACION_CARRITO_MS_LOADED = true;
}

// ========== SISTEMA DE PAUSA EN PÁGINAS PROTEGIDAS ==========
// Detectar si estamos en checkout/pago y pausar el temporizador
window.esPagenaProtegida = function () {
    const path = window.location.pathname;
    return path.includes('/checkout') || path.includes('/pago') || path.includes('/pago-exitoso');
};

window.pausarTemporizador = function () {
    console.log('[carrito] Temporizador pausado - estamos en página protegida');
    // Pausar ajustando el tiempoAgregado de todos los items
    const carritoActual = JSON.parse(localStorage.getItem('carrito') || '[]');
    if (carritoActual.length > 0) {
        // Guardar el tiempo actual como referencia
        sessionStorage.setItem('carritoTiempoPausado', Date.now().toString());
        carritoActual.forEach(item => {
            if (item.tiempoAgregado) {
                // Ajustar el tiempoAgregado para que el tiempo no pase
                // No modificamos, solo guardamos que está pausado
            }
        });
        console.log('[carrito] Carrito pausado con', carritoActual.length, 'items');
    }
};

window.reanudarTemporizador = function () {
    console.log('[carrito] Temporizador reanudado - salimos de página protegida');
    const tiempoPausado = parseInt(sessionStorage.getItem('carritoTiempoPausado') || '0');
    if (tiempoPausado > 0) {
        const ahora = Date.now();
        const tiempoEnPausa = ahora - tiempoPausado;

        // Ajustar todos los items para compensar el tiempo en pausa
        const carritoActual = JSON.parse(localStorage.getItem('carrito') || '[]');
        carritoActual.forEach(item => {
            if (item.tiempoAgregado) {
                // Mover el tiempoAgregado hacia adelante para compensar la pausa
                item.tiempoAgregado += tiempoEnPausa;
            }
        });

        localStorage.setItem('carrito', JSON.stringify(carritoActual));
        window.carrito = carritoActual;
        carrito = carritoActual;

        sessionStorage.removeItem('carritoTiempoPausado');
        console.log('[carrito] Temporizador reanudado - ajustado por', Math.floor(tiempoEnPausa / 1000), 'segundos en pausa');
    }
};

// Detectar cambios de página y pausar/reanudar según corresponda
window.addEventListener('DOMContentLoaded', function () {
    if (window.esPagenaProtegida()) {
        window.pausarTemporizador();
    } else {
        window.reanudarTemporizador();
    }
});

// Escuchar cambios en el location (navegación)
window.addEventListener('popstate', function () {
    if (window.esPagenaProtegida()) {
        window.pausarTemporizador();
    } else {
        window.reanudarTemporizador();
    }
});

// Para navegación con Astro (spa-like), escuchar cambios de URL
window.addEventListener('astro:before-preparation', function () {
    if (window.esPagenaProtegida()) {
        window.pausarTemporizador();
    } else {
        window.reanudarTemporizador();
    }
});

// Función para restaurar stock de un producto
async function restaurarStockProducto(productoId, cantidad) {
    if (!window.supabaseClient) return;

    try {
        const { data: producto, error: errorGet } = await window.supabaseClient
            .from('products')
            .select('stock')
            .eq('id', productoId)
            .single();

        if (errorGet) {
            console.error('[restaurarStockProducto] Error obteniendo producto:', errorGet);
            return;
        }

        const nuevoStock = (producto?.stock || 0) + cantidad;
        const { error: errorUpdate } = await window.supabaseClient
            .from('products')
            .update({ stock: nuevoStock })
            .eq('id', productoId);

        if (errorUpdate) {
            console.error('[restaurarStockProducto] Error actualizando stock:', errorUpdate);
            return;
        }

        console.log('[restaurarStockProducto] Stock restaurado para producto', productoId, 'cantidad:', cantidad, 'nuevo stock:', nuevoStock);
    } catch (err) {
        console.error('[restaurarStockProducto] Error:', err);
    }
}

// Función para verificar y limpiar items expirados del carrito
async function verificarExpirationCarrito() {
    // ⚠️ NO limpiar el carrito si estamos en checkout/pago
    if (window.esPagenaProtegida && window.esPagenaProtegida()) {
        console.log('[verificarExpirationCarrito] Página protegida detectada - temporizador pausado');
        return;
    }

    const carritoActual = JSON.parse(localStorage.getItem('carrito') || '[]');
    if (carritoActual.length === 0) return;

    const ahora = Date.now();
    let itemsActualizados = false;
    const itemsExpirados = [];

    for (let i = carritoActual.length - 1; i >= 0; i--) {
        const item = carritoActual[i];
        const tiempoAgregado = item.tiempoAgregado || 0;
        const tiempoEnCarrito = ahora - tiempoAgregado;

        // Si el item NO tiene timestamp, asignarle uno ahora
        if (!item.tiempoAgregado) {
            carritoActual[i].tiempoAgregado = ahora;
            itemsActualizados = true;
            continue;
        }

        if (tiempoEnCarrito > window.EXPIRACION_CARRITO_MS) {
            console.log('[verificarExpirationCarrito] Item expirado:', item.nombre, 'tiempo en carrito:', Math.floor(tiempoEnCarrito / 1000), 'segundos');

            // Restaurar stock de la BD
            await restaurarStockProducto(item.id, item.cantidad);

            itemsExpirados.push({
                nombre: item.nombre,
                cantidad: item.cantidad
            });

            // Eliminar del carrito
            carritoActual.splice(i, 1);
            itemsActualizados = true;
        }
    }

    if (itemsActualizados) {
        // Guardar carrito actualizado
        localStorage.setItem('carrito', JSON.stringify(carritoActual));
        window.carrito = carritoActual;
        carrito = carritoActual;

        console.log('[verificarExpirationCarrito] Carrito actualizado. Items expirados removidos:', itemsExpirados.length, 'Items restantes:', carritoActual.length);

        // Mostrar notificación al usuario
        if (itemsExpirados.length > 0) {
            mostrarNotificacionExpiracion(itemsExpirados);
        }

        // Actualizar UI
        if (typeof renderizarCarrito === 'function') {
            renderizarCarrito();
        }
        if (typeof calcularTotales === 'function') {
            calcularTotales();
        }
        if (typeof updateCartCount === 'function') {
            updateCartCount();
        }
        if (typeof renderCartSlide === 'function') {
            renderCartSlide();
        }
        // ⚠️ Llamadas a funciones de expiración removidas - ahora gestionadas por PublicLayout.astro

        // ❌ Carrito NO se sincroniza con BD - solo se usa localStorage

        // Disparar evento de actualización
        window.dispatchEvent(new CustomEvent('carritoActualizado', {
            detail: { carrito: carritoActual, expirado: true }
        }));
    }
}

// Mostrar notificación de expiración
function mostrarNotificacionExpiracion(items) {
    const mensaje = `Tu reserva expiró. Se removieron ${items.length} producto(s) del carrito:\n${items.map(i => `${i.nombre} (${i.cantidad}x)`).join(', ')}`;

    // Crear modal de notificación
    let notifDiv = document.getElementById('notif-expiracion-carrito');
    if (!notifDiv) {
        notifDiv = document.createElement('div');
        notifDiv.id = 'notif-expiracion-carrito';
        document.body.appendChild(notifDiv);
    }

    notifDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #ff6b6b;
        color: white;
        padding: 16px 24px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 14px;
        max-width: 500px;
        animation: slideDown 0.3s ease-out;
    `;

    notifDiv.textContent = mensaje;
    notifDiv.style.display = 'block';

    setTimeout(() => {
        notifDiv.style.display = 'none';
    }, 5000);
}

// ⚠️ DESACTIVADO: La expiración ahora se maneja en PublicLayout.astro -> gestionarExpirationCarrito()
// setInterval(verificarExpirationCarrito, 1 * 1000); // Verificar cada segundo

// ⚠️ DESACTIVADO: Se maneja globalmente en PublicLayout.astro
// document.addEventListener('DOMContentLoaded', verificarExpirationCarrito);

// Obtener ID del usuario actual
function getCurrentUserId() {
    if (window.currentUserData && window.currentUserData.id) {
        return window.currentUserData.id;
    }
    return null;
}

// Guardar carrito (solo en localStorage)
async function guardarCarritoEnBD() {
    // El carrito solo se guarda en localStorage, no en BD
    console.log('Carrito guardado en localStorage');
}

// Fusionar carritos (localStorage + BD)
function fusionarCarritos(carritoLocal, carritoBD) {
    const merged = [...carritoBD];

    carritoLocal.forEach(itemLocal => {
        const existingIndex = merged.findIndex(item => item.id === itemLocal.id);
        if (existingIndex >= 0) {
            // Si existe, sumar cantidades
            merged[existingIndex].cantidad += itemLocal.cantidad;
        } else {
            // Si no existe, agregar
            merged.push(itemLocal);
        }
    });

    return merged;
}

// Cargar carrito al abrir la página
async function cargarCarrito() {
    console.log('cargarCarrito() iniciada');
    console.log('currentUserData:', window.currentUserData);

    // 🛑 NO CARGAR CARRITO SI ESTAMOS EN PÁGINA DE PAGO EXITOSO
    // La página de pago-exitoso.astro ya se encarga de limpiar el carrito
    const pagePath = window.location.pathname;
    if (pagePath.includes('pago-exitoso')) {
        console.log('🛑 Estamos en pago-exitoso, limpiando carrito');
        window.carrito = [];
        carrito = [];
        localStorage.setItem('carrito', JSON.stringify([]));
        renderizarCarrito();
        calcularTotales();
        return;
    }

    // Cargar de localStorage (único almacenamiento del carrito)
    const carritoLocal = JSON.parse(localStorage.getItem('carrito') || '[]');
    console.log('Carrito cargado de localStorage:', carritoLocal.length, 'items');

    window.carrito = carritoLocal;
    carrito = window.carrito;

    console.log('Carrito final:', window.carrito.length, 'items');
    renderizarCarrito();

    // Esperar un poco para que renderizarCarrito() actualice el DOM
    setTimeout(() => {
        console.log('Llamando a calcularTotales() después de renderizar');
        calcularTotales();
    }, 50);
}

// Hacer cargarCarrito global para que auth-new.js pueda llamarla
window.cargarCarrito = cargarCarrito;

// Función global para sincronizar carrito después de login (fusiona UNA sola vez al hacer login)
window.sincronizarCarritoConBD = async function () {
    console.log('Sincronización de carrito con BD DESHABILITADA - usando solo localStorage');

    // Solo cargar de localStorage, sin tocar BD
    const carritoLocal = JSON.parse(localStorage.getItem('carrito') || '[]');
    window.carrito = carritoLocal;
    carrito = window.carrito;

    localStorage.setItem('carrito', JSON.stringify(carrito));
    renderizarCarrito();
    calcularTotales();
};
// Función global para guardar carrito antes de logout
window.guardarCarritoAntesDeLogout = async function () {
    console.log('Carrito NO se guarda en BD - solo se usa localStorage');
    // No hacer nada, el carrito se mantiene en localStorage
};

// Renderizar tabla del carrito
function renderizarCarrito() {
    const carritoActual = window.carrito || carrito || [];
    console.log('renderizarCarrito() - carrito:', carritoActual);

    const tbody = document.getElementById('carrito-tbody');
    const vacioMsg = document.getElementById('carrito-vacio');
    const table = document.getElementById('carrito-table');

    // ⚠️ Validar que los elementos existan (pueden no estar en todas las páginas)
    if (!table || !vacioMsg) {
        console.log('renderizarCarrito() - Elementos del carrito no encontrados en esta página, saltando renderizado');
        return;
    }

    if (carritoActual.length === 0) {
        console.log('Carrito vacío, mostrando mensaje');
        table.style.display = 'none';
        vacioMsg.style.display = 'block';
        updateCartCount();

        // Limpiar contador
        const timerContainer = document.getElementById('carrito-timer');
        if (timerContainer) {
            timerContainer.style.display = 'none';
        }
        return;
    }

    console.log('Carrito con items, renderizando tabla');
    table.style.display = 'table';
    vacioMsg.style.display = 'none';

    // Mostrar contador si hay items
    const timerContainer = document.getElementById('carrito-timer');
    if (timerContainer) {
        timerContainer.style.display = 'block';
    }

    if (!tbody) {
        console.warn('renderizarCarrito() - tbody no encontrado');
        return;
    }

    tbody.innerHTML = '';

    carritoActual.forEach((item, index) => {
        const row = document.createElement('tr');
        const subtotal = item.precio * item.cantidad;

        // Verificar si el producto tiene una reserva activa
        let timerBadge = '';
        if (typeof getReservedQuantity === 'function') {
            const reserved = getReservedQuantity(item.id);
            if (reserved > 0) {
                // Obtener tiempo restante de la reserva
                const reservations = typeof getReservations === 'function' ? getReservations() : {};
                const key = `product_${item.id}`;
                if (reservations[key]) {
                    const now = Date.now();
                    const timeLeft = Math.max(0, reservations[key].expiresAt - now);
                    const minutesLeft = Math.ceil(timeLeft / 60000);
                    timerBadge = `<span class="reservation-timer-badge" data-product-id="${item.id}" data-expires="${reservations[key].expiresAt}">${minutesLeft}m</span>`;
                }
            }
        }

        row.innerHTML = `
            <td>
                <div class="producto-carrito">
                    ${item.imagen ? `
                        <div class="producto-carrito-img">
                            <img src="${item.imagen}" alt="${item.nombre}">
                        </div>
                    ` : ''}
                    <div class="producto-carrito-nombre">
                        ${item.nombre}${timerBadge}
                        ${item.talla ? `<div style="font-size: 0.85rem; color: #666; margin-top: 0.2rem;">Talla: <strong>${item.talla}</strong></div>` : ''}
                    </div>
                </div>
            </td>
            <td>€${parseFloat(item.precio).toFixed(2)}</td>
            <td>
                <div class="cantidad-controls">
                    <button class="btn-cantidad" onclick="decrementarCantidad(${index})">−</button>
                    <input type="number" class="cantidad-input" id="cantidad-${index}" value="${item.cantidad}" min="1" 
                        onchange="actualizarCantidad(${index}, this.value)"
                        oninput="validarStockEnTimeReal(${index}, this.value)">
                    <button class="btn-cantidad" onclick="incrementarCantidad(${index})">+</button>
                </div>
            </td>
            <td>€${subtotal.toFixed(2)}</td>
            <td>
                <button class="btn-eliminar" onclick="eliminarDelCarrito(${index})">Eliminar</button>
            </td>
        `;

        tbody.appendChild(row);
    });

    updateCartCount();
}

// Mostrar mensaje de error de stock
function mostrarErrorStock(mensaje) {
    // Crear o obtener el contenedor de mensaje
    let errorDiv = document.getElementById('error-stock-msg');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-stock-msg';
        document.body.appendChild(errorDiv);
    }

    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';

    // Ocultar después de 2 segundos
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 2000);
}

// Validar stock en tiempo real mientras se escribe en el input
async function validarStockEnTimeReal(index, valor) {
    const cantidad = parseInt(valor) || 0;
    const carritoActual = JSON.parse(localStorage.getItem('carrito') || '[]');
    const item = carritoActual[index];

    if (!item || !window.supabaseClient) return;

    try {
        const { data: producto } = await window.supabaseClient
            .from('products')
            .select('stock')
            .eq('id', item.id)
            .single();

        if (!producto) return;

        // Calcular stock disponible
        const cantidadActualEnCarrito = item.cantidad;
        const stockOriginal = producto.stock + cantidadActualEnCarrito;

        let cantidadOtrosEnCarrito = 0;
        for (let i = 0; i < carritoActual.length; i++) {
            if (i !== index && carritoActual[i].id === item.id) {
                cantidadOtrosEnCarrito += carritoActual[i].cantidad;
            }
        }

        const stockDisponible = stockOriginal - cantidadOtrosEnCarrito;

        // Limitar el valor máximo en el input
        const inputEl = document.getElementById(`cantidad-${index}`);
        if (inputEl) {
            inputEl.max = stockDisponible;
        }

        // Mostrar advertencia visual si se intenta exceder el stock
        if (cantidad > stockDisponible) {
            inputEl.style.borderColor = '#ff6b6b';
            inputEl.style.backgroundColor = '#fff5f5';
        } else {
            inputEl.style.borderColor = '';
            inputEl.style.backgroundColor = '';
        }

    } catch (err) {
        console.error('[validarStockEnTimeReal] Error:', err);
    }
}

// Actualizar cantidad
async function actualizarCantidad(index, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad);

    // Leer carrito desde localStorage para estar sincronizado
    const carritoActual = JSON.parse(localStorage.getItem('carrito') || '[]');
    const item = carritoActual[index];

    if (!item) {
        console.error('Item no encontrado en índice:', index);
        return;
    }

    if (cantidad < 1) {
        eliminarDelCarrito(index);
        return;
    }

    const cantidadAnterior = item.cantidad;
    const diferencia = cantidad - cantidadAnterior;

    // Verificar stock disponible
    if (window.supabaseClient) {
        try {
            const { data: producto, error } = await window.supabaseClient
                .from('products')
                .select('stock')
                .eq('id', item.id)
                .single();

            if (error || !producto) {
                console.error('Error obteniendo stock del producto:', error);
                mostrarErrorStock('Error al verificar el stock');
                return;
            }

            // CORRECCIÓN: El stock en BD ya está reducido por lo que está en carrito
            // Calcular stock ORIGINAL = stock_actual_en_bd + cantidad_en_carrito_actual
            const cantidadActualEnCarrito = item.cantidad;
            const stockOriginal = producto.stock + cantidadActualEnCarrito;

            // Calcular stock disponible (considerando otros items del mismo producto en carrito)
            let cantidadOtrosEnCarrito = 0;
            for (let i = 0; i < carritoActual.length; i++) {
                if (i !== index && carritoActual[i].id === item.id) {
                    cantidadOtrosEnCarrito += carritoActual[i].cantidad;
                }
            }

            const stockDisponible = stockOriginal - cantidadOtrosEnCarrito;

            if (cantidad > stockDisponible) {
                mostrarErrorStock(`No hay suficiente stock. Disponible: ${stockDisponible}`);
                // Restaurar valor anterior
                renderizarCarrito();
                return;
            }

            console.log('[actualizarCantidad] Validación - Stock BD:', producto.stock, 'En carrito:', cantidadActualEnCarrito, 'Original:', stockOriginal, 'Disponible:', stockDisponible, 'Solicitado:', cantidad);
        } catch (err) {
            console.error('Error en actualizarCantidad:', err);
            mostrarErrorStock('Error al verificar el stock');
            return;
        }
    }

    // Actualizar cantidad
    carritoActual[index].cantidad = cantidad;

    // Sincronizar localStorage Y window.carrito
    localStorage.setItem('carrito', JSON.stringify(carritoActual));
    window.carrito = carritoActual;
    carrito = carritoActual;

    // Dispatch event para que otros scripts sepan que el carrito cambió
    window.dispatchEvent(new CustomEvent('carritoActualizado', {
        detail: { carrito: carritoActual, productoId: item.id }
    }));

    // Ajustar stock en BD según el cambio de cantidad
    if (diferencia !== 0 && window.supabaseClient) {
        const accion = diferencia > 0 ? 'restar' : 'sumar';
        const cantidadAjuste = Math.abs(diferencia);

        fetch('/api/update-cart-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: item.id,
                cantidad: cantidadAjuste,
                accion: accion
            })
        })
            .then(res => {
                if (!res.ok) {
                    console.warn('[actualizarCantidad] API error:', res.status);
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (data?.success) {
                    console.log('[actualizarCantidad] Stock ajustado:', data);
                }
            })
            .catch(err => console.warn('[actualizarCantidad] Error ajustando stock:', err));
    }

    // Actualizar UI
    renderizarCarrito();
    calcularTotales();

    // Sincronizar con BD si hay usuario logueado
    await guardarCarritoEnBD();
}

// Incrementar cantidad
async function incrementarCantidad(index) {
    const item = carrito[index];
    const nuevaCantidad = item.cantidad + 1;
    await actualizarCantidad(index, nuevaCantidad);
}

// Decrementar cantidad
async function decrementarCantidad(index) {
    const item = carrito[index];
    const nuevaCantidad = item.cantidad - 1;
    await actualizarCantidad(index, nuevaCantidad);
}

// Eliminar del carrito
async function eliminarDelCarrito(index) {
    // Obtener el producto antes de eliminarlo para restaurar su stock
    // Usar window.carrito como referencia principal
    const carritoActual = window.carrito || carrito || JSON.parse(localStorage.getItem('carrito') || '[]');
    const productoEliminado = carritoActual[index];

    console.log('[eliminarDelCarrito] Eliminando producto en índice:', index, productoEliminado);

    // Eliminar del array
    carritoActual.splice(index, 1);

    // Actualizar referencias GLOBALES
    window.carrito = carritoActual;
    carrito = carritoActual;

    // Guardar en localStorage
    localStorage.setItem('carrito', JSON.stringify(carritoActual));
    console.log('[eliminarDelCarrito] Carrito después de eliminar:', carritoActual);
    console.log('[eliminarDelCarrito] window.carrito sincronizado:', window.carrito);

    // Restaurar stock en la BD si existe el producto
    if (productoEliminado && productoEliminado.cantidad) {
        console.log('[eliminarDelCarrito] Restaurando stock del producto:', productoEliminado);

        if (typeof releaseReservation === 'function') {
            releaseReservation(productoEliminado.id);
        }

        // Restaurar stock en BD usando API
        if (window.supabaseClient) {
            fetch('/api/update-cart-stock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: productoEliminado.id,
                    cantidad: productoEliminado.cantidad,
                    accion: 'sumar'
                })
            })
                .then(res => {
                    if (!res.ok) {
                        console.warn('[eliminarDelCarrito] API error:', res.status);
                        return null;
                    }
                    return res.json();
                })
                .then(data => {
                    if (data?.success) {
                        console.log('[eliminarDelCarrito] Stock restaurado:', data);
                    }
                })
                .catch(err => console.warn('[eliminarDelCarrito] Error restaurando stock:', err));
        }
    }

    renderizarCarrito();
    calcularTotales();

    // Sincronizar con BD si hay usuario logueado
    await guardarCarritoEnBD();
}

// Calcular totales
function calcularTotales() {
    // Usar window.carrito para asegurar que siempre tenga los datos actualizados
    const carritoActual = window.carrito || carrito || [];

    console.log('calcularTotales() - carrito:', carritoActual);

    let subtotal = 0;

    carritoActual.forEach(item => {
        subtotal += item.precio * item.cantidad;
    });

    // Si carrito vacío, no mostrar envío
    let envio = 0;
    let mostrarEnvio = false;

    if (subtotal > 0) {
        mostrarEnvio = true;
        // Envío €3 si es menor a 100€, gratis si es 100€ o más
        envio = subtotal >= 100 ? 0 : 3;
    }

    // Aplicar descuento
    const descuento = subtotal * (descuentoAplicado / 100);

    const total = subtotal + envio - descuento;

    console.log('calcularTotales() - subtotal:', subtotal, 'envio:', envio, 'total:', total);

    // Actualizar elementos
    const subtotalEl = document.getElementById('subtotal');
    const envioEl = document.getElementById('envio');
    const envioRowEl = document.getElementById('envio-row');
    const descuentoRowEl = document.getElementById('descuento-row');
    const descuentoAmountEl = document.getElementById('descuento-amount');
    const totalEl = document.getElementById('total');

    if (subtotalEl) subtotalEl.textContent = `€${subtotal.toFixed(2)}`;

    // Mostrar/ocultar fila de envío
    if (envioRowEl) {
        envioRowEl.style.display = mostrarEnvio ? 'flex' : 'none';
    }
    if (envioEl) {
        envioEl.textContent = envio > 0 ? `€${envio.toFixed(2)}` : 'Gratis';
    }

    if (descuentoAplicado > 0) {
        if (descuentoRowEl) descuentoRowEl.style.display = 'flex';
        if (descuentoAmountEl) descuentoAmountEl.textContent = `-€${descuento.toFixed(2)}`;
    } else {
        if (descuentoRowEl) descuentoRowEl.style.display = 'none';
    }

    if (totalEl) totalEl.textContent = `€${total.toFixed(2)}`;
}

// Hacer calcularTotales global
window.calcularTotales = calcularTotales;

// Mostrar notificación toast
function mostrarNotificacion(mensaje, tipo = 'success') {
    // Crear contenedor si no existe
    let container = document.getElementById('notificaciones-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificaciones-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }

    // Crear notificación
    const notificacion = document.createElement('div');
    const colores = {
        success: { bg: '#4caf50', icon: '✓' },
        error: { bg: '#f44336', icon: '✕' },
        info: { bg: '#2196f3', icon: 'ℹ' }
    };

    const config = colores[tipo] || colores.info;

    notificacion.style.cssText = `
        background: ${config.bg};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
        max-width: 350px;
        word-wrap: break-word;
    `;

    notificacion.innerHTML = `<span style="font-size: 18px; font-weight: bold;">${config.icon}</span><span>${mensaje}</span>`;
    container.appendChild(notificacion);

    // Auto-remover después de 4 segundos
    setTimeout(() => {
        notificacion.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notificacion.remove(), 300);
    }, 4000);
}

// Agregar animaciones CSS
if (!document.getElementById('notificacion-styles')) {
    const style = document.createElement('style');
    style.id = 'notificacion-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(400px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        @keyframes slideOut {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(400px);
            }
        }
    `;
    document.head.appendChild(style);
}

// Aplicar descuento
async function aplicarDescuento() {
    const codigo = document.getElementById('codigo-descuento').value.toUpperCase().trim();
    const boton = event.target;

    if (!codigo) {
        mostrarNotificacion('Por favor ingresa un código de descuento', 'info');
        return;
    }

    // Evitar doble click
    boton.disabled = true;
    boton.style.opacity = '0.5';

    try {
        // Verificar si ya hay descuento aplicado
        if (descuentoAplicado > 0) {
            mostrarNotificacion('Ya tienes un descuento aplicado', 'info');
            boton.disabled = false;
            boton.style.opacity = '1';
            return;
        }

        // Usar la función de validación desde descuentos.js
        const resultado = await aplicarCodigo(codigo);

        if (resultado.error) {
            mostrarNotificacion(resultado.error, 'error');
            boton.disabled = false;
            boton.style.opacity = '1';
            return;
        }

        // Descuento válido
        descuentoAplicado = resultado.porcentaje;

        // Guardar el ID del descuento en sesión (para registrar uso después)
        sessionStorage.setItem('descuento_id', resultado.id);
        sessionStorage.setItem('descuento_codigo', resultado.codigo);

        console.log('[aplicarDescuento] Descuento guardado en sessionStorage:', {
            descuento_id: resultado.id,
            descuento_codigo: resultado.codigo,
            descuento_porcentaje: resultado.porcentaje
        });

        mostrarNotificacion(`Descuento de ${resultado.porcentaje}% aplicado correctamente${resultado.descripcion ? ' - ' + resultado.descripcion : ''}`, 'success');

        // Desactivar input y botón
        document.getElementById('codigo-descuento').disabled = true;
        document.getElementById('codigo-descuento').value = resultado.codigo;
        boton.disabled = true;
        boton.textContent = 'Aplicado';
        boton.style.opacity = '0.6';

        calcularTotales();

    } catch (error) {
        console.error('Error aplicando descuento:', error);
        mostrarNotificacion('Error al procesar el descuento', 'error');
        boton.disabled = false;
        boton.style.opacity = '1';
    }
}

// Ir a checkout
function irACheckout() {
    if (carrito.length === 0) {
        notify.warning('Tu carrito está vacío. Añade productos antes de continuar', 'Carrito vacío', 4000);
        return;
    }

    // Guardar carrito en sesión para checkout
    sessionStorage.setItem('carrito-checkout', JSON.stringify(carrito));
    sessionStorage.setItem('descuento', descuentoAplicado);

    // El descuento_id ya está guardado en aplicarDescuento()
    // Solo verificar que esté presente en logs
    const descuentoId = sessionStorage.getItem('descuento_id');
    console.log('[irACheckout] Descuento guardado en sesión:', { descuentoAplicado, descuentoId });

    window.location.href = '/checkout';
}

// Actualizar contador
function updateCartCount() {
    const count = carrito.reduce((total, item) => total + item.cantidad, 0);
    document.getElementById('cart-count').textContent = count;
}

// ⚠️ FUNCIÓN DESACTIVADA: La expiración ahora se maneja globalmente en PublicLayout.astro
// Esta función se mantiene solo por compatibilidad, pero no se ejecuta
function actualizarContadorExpiracion() {
    // DESACTIVADA - Ver PublicLayout.astro -> gestionarExpirationCarrito()
    console.log('[carrito.js] actualizarContadorExpiracion DESACTIVADA - usando función global');
}

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded en carrito.js');
    console.log('window.currentUserData:', window.currentUserData);

    // Cargar carrito
    console.log('Llamando a cargarCarrito()');
    await cargarCarrito();

    // ⚠️ Contador de expiración removido - ahora gestionado globalmente en PublicLayout.astro

    // Actualizar badges de temporizador cada segundo
    setInterval(() => {
        try {
            const badges = document.querySelectorAll('.reservation-timer-badge');
            badges.forEach(badge => {
                const expiresAt = parseInt(badge.getAttribute('data-expires'));
                const now = Date.now();
                const timeLeft = Math.max(0, expiresAt - now);
                const minutesLeft = Math.ceil(timeLeft / 60000);

                if (minutesLeft <= 0) {
                    badge.remove();
                } else {
                    badge.textContent = `⏱ ${minutesLeft}m`;
                }
            });
        } catch (e) {
            console.error('[timer-update] Error:', e);
        }
    }, 1000);
});
