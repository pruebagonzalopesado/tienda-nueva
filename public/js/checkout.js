// Checkout
console.log('checkout.js cargado');
console.log('window.STRIPE_PUBLIC_KEY al cargar:', window.STRIPE_PUBLIC_KEY);

// Función para mostrar modal de error profesional
function mostrarModalError(titulo, mensaje) {
    // Crear contenedor del modal
    let modal = document.getElementById('checkout-error-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'checkout-error-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        document.body.appendChild(modal);
    }
    
    // Crear contenido del modal
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 32px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: slideInModal 0.3s ease-out;
        ">
            <div style="
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            ">
                <div style="
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: #ff6b6b;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                ">
                    <span style="color: white; font-size: 24px; font-weight: bold;">!</span>
                </div>
                <h2 style="
                    margin: 0;
                    color: #333;
                    font-size: 20px;
                    font-weight: 600;
                ">${titulo}</h2>
            </div>
            <p style="
                color: #666;
                font-size: 16px;
                line-height: 1.5;
                margin: 16px 0 24px 0;
            ">${mensaje}</p>
            <button onclick="document.getElementById('checkout-error-modal').style.display = 'none'" style="
                width: 100%;
                padding: 12px 24px;
                background: #d4af37;
                color: #1a1a1a;
                border: none;
                border-radius: 4px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.3s;
            " onmouseover="this.style.background='#c99f2e'" onmouseout="this.style.background='#d4af37'">
                Entendido
            </button>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    // Agregar estilos de animación
    if (!document.getElementById('checkout-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'checkout-modal-styles';
        style.textContent = `
            @keyframes slideInModal {
                from {
                    transform: translateY(-30px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Usar window para evitar conflicto con carrito.js
if (!window.carritoCheckout) {
    window.carritoCheckout = [];
}
let descuentoAplicado = 0;

// Cargar datos del checkout
function cargarCheckout() {
    // Intentar cargar del sessionStorage primero (desde carrito)
    let carritoData = sessionStorage.getItem('carrito-checkout');
    
    // Si no hay en sessionStorage, intentar desde localStorage
    if (!carritoData) {
        carritoData = localStorage.getItem('carrito');
    }
    
    window.carritoCheckout = carritoData ? JSON.parse(carritoData) : [];
    descuentoAplicado = parseInt(sessionStorage.getItem('descuento') || '0');
    
    // En desarrollo, permitir carrito vacío para testing
    if (window.carritoCheckout.length === 0 && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        window.location.href = '/carrito';
        return;
    }
    
    renderizarOrden();
}

// Renderizar orden
function renderizarOrden() {
    let subtotal = 0;
    const orderItems = document.getElementById('order-items');
    orderItems.innerHTML = '';
    
    window.carritoCheckout.forEach(item => {
        const itemTotal = item.precio * item.cantidad;
        subtotal += itemTotal;
        
        const itemEl = document.createElement('div');
        itemEl.className = 'order-item';
        itemEl.innerHTML = `
            <span class="order-item-name">${item.nombre}</span>
            <span class="order-item-qty">x${item.cantidad}</span>
            <span class="order-item-price">€${itemTotal.toFixed(2)}</span>
        `;
        orderItems.appendChild(itemEl);
    });
    
    // Calcular totales
    const envio = subtotal > 100 ? 0 : 9.99;
    const descuento = subtotal * (descuentoAplicado / 100);
    const total = subtotal + envio - descuento;
    
    document.getElementById('checkout-subtotal').textContent = `€${subtotal.toFixed(2)}`;
    document.getElementById('checkout-envio').textContent = envio > 0 ? `€${envio.toFixed(2)}` : 'Gratis';
    
    if (descuentoAplicado > 0) {
        document.getElementById('checkout-descuento-row').style.display = 'flex';
        document.getElementById('checkout-descuento').textContent = `-€${descuento.toFixed(2)}`;
    }
    
    document.getElementById('checkout-total').textContent = `€${total.toFixed(2)}`;
}

// Configurar método de pago
function configurarMetodoPago() {
    // Ya no se necesita configuración de radio buttons
    // El elemento card de Stripe siempre está visible
    console.log('Sistema de pago Stripe configurado');
}

// Cargar y rellenar datos del usuario desde la API
async function cargarYRellenarDatosUsuario() {
    console.log('[checkout] Iniciando carga de datos previos...');
    
    try {
        // Obtener sesión del localStorage - buscar la clave de auth
        let sessionStr = null;
        let authKey = null;
        
        // Buscar cualquier clave que contenga 'auth-token'
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('auth-token')) {
                authKey = key;
                sessionStr = localStorage.getItem(key);
                break;
            }
        }
        
        if (!sessionStr) {
            console.log('[checkout] No hay sesión almacenada');
            return;
        }
        
        console.log('[checkout] Session en localStorage: true (clave: ' + authKey + ')');
        const session = JSON.parse(sessionStr);
        console.log('[checkout] Sesión parseada. Estructura:', Object.keys(session));
        console.log('[checkout] Contenido completo:', session);
        
        const email = session.user?.email;
        const accessToken = session.access_token;
        
        if (!email || !accessToken) {
            console.log('[checkout] Email o token no disponibles');
            return;
        }
        
        console.log('[checkout] Email encontrado:', email);
        console.log('[checkout] Access token disponible:', !!accessToken);
        
        // Pre-llenar email
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = email;
            console.log('[checkout] Email pre-llenado:', email);
        }
        
        // Llamar a la API para obtener datos del usuario
        console.log('[checkout] Llamando /api/get-user-data con token...');
        const response = await fetch('/api/get-user-data', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        console.log('[checkout] Status de respuesta:', response.status);
        
        if (!response.ok) {
            console.error('[checkout] Error en respuesta:', response.status);
            return;
        }
        
        const data = await response.json();
        console.log('[checkout] Respuesta completa:', data);
        
        if (!data.usuarioData) {
            console.log('[checkout] No hay datos de usuario en respuesta');
            return;
        }
        
        const usuario = data.usuarioData;
        console.log('[checkout] ✓ Datos del usuario recibidos:', Object.keys(usuario));
        
        // Mapping de campos del formulario a propiedades del usuario
        const campos = [
            { id: 'nombre', propiedad: 'nombre' },
            { id: 'email', propiedad: 'email' },
            { id: 'telefono', propiedad: 'telefono' },
            { id: 'direccion', propiedad: 'direccion' },
            { id: 'ciudad', propiedad: 'ciudad' },
            { id: 'codigo-postal', propiedad: 'codigo_postal' },
            { id: 'pais', propiedad: 'pais' }
        ];
        
        // Rellenar cada campo
        campos.forEach(campo => {
            const input = document.getElementById(campo.id);
            const valor = usuario[campo.propiedad];
            
            console.log('[checkout] Campo ' + campo.id + ': encontrado valor:', valor);
            
            if (input && valor) {
                input.value = valor;
                console.log('[checkout] ✓ ' + campo.id + ' = ' + valor);
            }
        });
        
        console.log('[checkout] ✅ ' + campos.length + ' campos pre-llenados correctamente');
        
    } catch (error) {
        console.error('[checkout] Error al cargar datos del usuario:', error);
    }
}

// Formatear número de tarjeta
document.addEventListener('DOMContentLoaded', () => {
    const numeroTarjeta = document.getElementById('numero-tarjeta');
    const expiracion = document.getElementById('expiracion');
    const cvv = document.getElementById('cvv');
    
    if (numeroTarjeta) {
        numeroTarjeta.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '');
            let formatted = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formatted;
        });
    }
    
    if (expiracion) {
        expiracion.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        });
    }
    
    if (cvv) {
        cvv.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
    
    // Cargar checkout y configurar métodos de pago
    console.log('DOMContentLoaded - cargarCheckout()');
    cargarCheckout();
    configurarMetodoPago();
    
    // Cargar datos del usuario si está logueado
    cargarYRellenarDatosUsuario();
    
    // Pequeño delay para asegurar que Stripe.js está listo
    console.log('Llamando a inicializarStripe() en 100ms...');
    setTimeout(() => {
        console.log('Ejecutando inicializarStripe()...');
        console.log('STRIPE_PUBLIC_KEY antes de inicializar:', window.STRIPE_PUBLIC_KEY);
        inicializarStripe();
    }, 100);
});

// Procesar pago
async function procesarPago(e) {
    e.preventDefault();
    
    // Validar datos
    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const telefono = document.getElementById('telefono').value;
    const direccion = document.getElementById('direccion').value;
    const ciudad = document.getElementById('ciudad').value;
    const codigoPostal = document.getElementById('codigo-postal').value;
    const pais = document.getElementById('pais').value;
    const terminos = document.getElementById('terminos').checked;
    
    if (!nombre || !email || !telefono || !direccion || !ciudad || !codigoPostal || !pais) {
        mostrarModalError('Campos Incompletos', 'Por favor completa todos los datos de envío requeridos.');
        return;
    }
    
    if (!terminos) {
        mostrarModalError('Términos no Aceptados', 'Debes aceptar los términos y condiciones para continuar con tu compra.');
        return;
    }
    
    // Usar Stripe siempre
    await procesarPagoConStripe({
        nombre,
        email,
        telefono,
        direccion,
        ciudad,
        codigoPostal,
        pais
    });
}

// Mostrar confirmación
function mostrarConfirmacion(pedido) {
    // Crear modal de confirmación
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    let total = 0;
    pedido.carrito.forEach(item => {
        total += item.precio * item.cantidad;
    });
    
    const descuento = total * (descuentoAplicado / 100);
    const envio = total > 100 ? 0 : 9.99;
    const totalFinal = total + envio - descuento;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        ">
            <div style="font-size: 60px; margin-bottom: 20px;">✓</div>
            <h1 style="color: var(--color-secundario); margin-bottom: 12px;">¡Compra Confirmada!</h1>
            <p style="color: #666; margin-bottom: 24px;">Tu pedido ha sido procesado exitosamente.</p>
            
            <div style="
                background: #f9f9f9;
                padding: 20px;
                border-radius: 8px;
                text-align: left;
                margin-bottom: 24px;
            ">
                <p><strong>Número de Pedido:</strong> ${pedido.id}</p>
                <p><strong>Cliente:</strong> ${pedido.cliente.nombre}</p>
                <p><strong>Email:</strong> ${pedido.cliente.email}</p>
                <p><strong>Total:</strong> €${totalFinal.toFixed(2)}</p>
                <p><strong>Método de Pago:</strong> ${pedido.metodoPago === 'tarjeta' ? 'Tarjeta de Crédito' : pedido.metodoPago === 'transferencia' ? 'Transferencia Bancaria' : 'PayPal'}</p>
                <p><strong>Estado:</strong> <span style="color: #ff9800;">Procesando</span></p>
            </div>
            
            <p style="color: #999; font-size: 14px; margin-bottom: 24px;">
                Se ha enviado una confirmación a tu email. Tu pedido llegará en 2-3 días laborales.
            </p>
            
            <a href="/" style="
                display: inline-block;
                background: var(--color-primario);
                color: #000;
                padding: 12px 24px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: bold;
                transition: background 0.3s;
            " onmouseover="this.style.background='#c69c2b'" onmouseout="this.style.background='var(--color-primario)'">
                Volver a Inicio
            </a>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Redirect después de 5 segundos
    setTimeout(() => {
        window.location.href = '/';
    }, 5000);
}

// ============= STRIPE INTEGRATION =============

// Inicializar Stripe cuando carga la página
let stripe = null;
let elements = null;
let cardElement = null;

function inicializarStripe() {
    console.log('Inicializando Stripe...');
    console.log('STRIPE_PUBLIC_KEY:', window.STRIPE_PUBLIC_KEY);
    
    if (!window.STRIPE_PUBLIC_KEY) {
        console.error('STRIPE_PUBLIC_KEY no está disponible');
        document.getElementById('card-loading').textContent = 'Error: Clave de Stripe no configurada';
        return;
    }
    
    if (typeof Stripe === 'undefined') {
        console.error('Stripe.js no está cargado');
        document.getElementById('card-loading').textContent = 'Error: No se pudo cargar Stripe';
        return;
    }
    
    console.log('Stripe.js está disponible, inicializando...');
    
    stripe = Stripe(window.STRIPE_PUBLIC_KEY);
    elements = stripe.elements();
    
    // Crear elemento de tarjeta
    const cardContainer = document.getElementById('card-element');
    if (cardContainer) {
        console.log('Montando card element...');
        
        // Ocultar texto de carga
        const loadingText = document.getElementById('card-loading');
        if (loadingText) {
            loadingText.style.display = 'none';
        }
        
        cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                        color: '#aab7c4',
                    },
                },
                invalid: {
                    color: '#9e2146',
                },
            },
        });
        cardElement.mount('#card-element');
        
        // Mostrar errores
        cardElement.addEventListener('change', function(event) {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
                console.error('Error de tarjeta:', event.error.message);
            } else {
                displayError.textContent = '';
            }
        });
        
        console.log('Card element montado correctamente');
    } else {
        console.warn('Elemento card-element no encontrado en el DOM');
    }
}


async function procesarPagoConStripe(datosCheckout) {
    console.log('Procesando pago con Stripe...');
    console.log('stripe:', stripe);
    console.log('cardElement:', cardElement);
    
    if (!stripe || !cardElement) {
        alert('Sistema de pago no disponible. Por favor intenta de nuevo.');
        console.error('Stripe no está listo:', { stripe, cardElement });
        return;
    }
    
    // Calcular total
    let subtotal = 0;
    window.carritoCheckout.forEach(item => {
        subtotal += item.precio * item.cantidad;
    });
    
    const envio = subtotal > 100 ? 0 : 3;
    const descuento = subtotal * (descuentoAplicado / 100);
    const total = subtotal + envio - descuento;
    
    try {
        // Mostrar loading
        const btn = document.querySelector('button[type="submit"]');
        const btnText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Procesando...';
        
        console.log('Creando Payment Intent...');
        
        // Crear Payment Intent en el servidor
        const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: total,
                email: datosCheckout.email,
                nombre: datosCheckout.nombre,
            }),
        });
        
        const paymentData = await response.json();
        console.log('Respuesta del servidor:', paymentData);
        
        if (!response.ok || !paymentData.clientSecret) {
            throw new Error(paymentData.error || 'Error al crear el pago');
        }
        
        console.log('Confirmando pago con tarjeta...');
        
        // Confirmar pago con Stripe
        const result = await stripe.confirmCardPayment(paymentData.clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: datosCheckout.nombre,
                    email: datosCheckout.email,
                    phone: datosCheckout.telefono,
                    address: {
                        line1: datosCheckout.direccion,
                        city: datosCheckout.ciudad,
                        postal_code: datosCheckout.codigoPostal,
                        country: datosCheckout.pais,
                    }
                }
            }
        });
        
        console.log('Resultado del pago:', result);
        
        if (result.error) {
            throw new Error(result.error.message);
        }
        
        if (result.paymentIntent.status === 'succeeded') {
            console.log('Pago exitoso');
            // Pago exitoso
            crearPedidoEnBD({
                ...datosCheckout,
                paymentIntentId: paymentData.paymentIntentId,
                total: total,
                subtotal: subtotal,
                envio: envio,
                descuento: descuento
            });
        } else {
            throw new Error('El pago no fue completado. Estado: ' + result.paymentIntent.status);
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar el pago: ' + error.message);
        
        const btn = document.querySelector('button[type="submit"]');
        btn.disabled = false;
        btn.textContent = 'Completar Compra';
    }
}

async function crearPedidoEnBD(datosCheckout) {
    try {
        // Crear pedido en BD con Supabase
        if (!window.supabaseClient) {
            throw new Error('Supabase no está disponible');
        }
        
        const usuario_id = window.currentUserData?.id || null;
        
        const { data: pedido, error } = await window.supabaseClient
            .from('pedidos')
            .insert([{
                usuario_id: usuario_id,
                nombre: datosCheckout.nombre,
                email: datosCheckout.email,
                telefono: datosCheckout.telefono,
                direccion: datosCheckout.direccion,
                ciudad: datosCheckout.ciudad,
                codigo_postal: datosCheckout.codigoPostal,
                pais: datosCheckout.pais,
                subtotal: datosCheckout.subtotal,
                envio: datosCheckout.envio,
                descuento: datosCheckout.descuento,
                total: datosCheckout.total,
                items: window.carritoCheckout,
                stripe_payment_id: datosCheckout.paymentIntentId,
                estado: 'confirmado',
                fecha_creacion: new Date().toISOString(),
            }]);
        
        if (error) throw error;
        
        // Registrar uso del descuento SI se aplicó uno
        const descuentoId = sessionStorage.getItem('descuento_id');
        const descuentoCodigo = sessionStorage.getItem('descuento_codigo');
        
        console.log('[checkout] Intentando registrar descuento:', { descuentoId, descuentoCodigo });
        
        if (descuentoId) {
            try {
                console.log('[checkout] Llamando registrarUsoDescuento con ID:', descuentoId);
                await registrarUsoDescuento(descuentoId);
                console.log('✓ Uso de descuento registrado exitosamente');
            } catch (err) {
                console.warn('⚠ No se pudo registrar el uso del descuento:', err);
                // No abortamos si esto falla, el pedido ya se creó
            }
        } else {
            console.log('[checkout] No hay descuento_id en sessionStorage');
        }
        
        // Limpiar carrito y liberar reservas de stock
        if (typeof onClearCart === 'function') {
            onClearCart();
        }
        localStorage.removeItem('carrito');
        sessionStorage.removeItem('carrito-checkout');
        sessionStorage.removeItem('descuento');
        
        // Mostrar confirmación
        mostrarConfirmacion({
            id: pedido[0].id,
            cliente: {
                nombre: datosCheckout.nombre,
                email: datosCheckout.email
            },
            carrito: carrito,
            metodoPago: 'tarjeta',
            total: datosCheckout.total
        });
        
    } catch (error) {
        console.error('Error creando pedido:', error);
        alert('Error al crear el pedido: ' + error.message);
    }
}
