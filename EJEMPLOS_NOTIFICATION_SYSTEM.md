/**
 * EJEMPLOS DE USO - NOTIFICATION SYSTEM
 * Reemplaza todos los alert() por notificaciones profesionales
 */

// ============================================
// USO BÁSICO
// ============================================

// Éxito
notify.success('Producto agregado al carrito correctamente');

// Error
notify.error('No hay stock disponible para este producto');

// Advertencia
notify.warning('Tu carrito tiene productos sin confirmar');

// Información
notify.info('Tu pedido ha sido enviado');


// ============================================
// CON TÍTULOS PERSONALIZADOS
// ============================================

notify.success('Compra completada', 'Pedido confirmado', 5000);
notify.error('Falta la dirección de envío', 'Campo requerido', 4000);
notify.warning('Stock limitado', 'Solo quedan 2 unidades', 5000);
notify.info('Nuevo descuento disponible', 'Promoción activa', 4000);


// ============================================
// EN VALIDACIÓN DE STOCK (Stock Real Time)
// ============================================

// Cuando un usuario agrega al carrito (carrito.js)
if (response.ok) {
    notify.success(`${producto.nombre} agregado al carrito`, 'Éxito', 3000);
} else {
    notify.error(data.error, 'Stock insuficiente', 4000);
}


// ============================================
// EN CHECKOUT (checkout.js)
// ============================================

// Validación de términos
if (!document.getElementById('terms-checkbox').checked) {
    notify.warning('Debes aceptar los términos y condiciones', 'Términos no aceptados', 4000);
    return;
}

// Validación de email
if (!email.includes('@')) {
    notify.error('Por favor ingresa un email válido', 'Email inválido', 4000);
    return;
}

// Completar compra
fetch('/api/create-payment-intent', { method: 'POST', body: JSON.stringify(cartData) })
    .then(res => {
        if (res.ok) {
            notify.success('Tu compra ha sido procesada correctamente', 'Pago exitoso', 5000);
            setTimeout(() => window.location.href = '/pago-exitoso', 1500);
        } else {
            notify.error('Error al procesar el pago. Intenta nuevamente', 'Error de pago', 5000);
        }
    });


// ============================================
// EN FORMULARIOS (contact-form.js, perfil-modal.js)
// ============================================

// Envío de formulario de contacto
fetch('/api/contact', { method: 'POST', body: JSON.stringify(formData) })
    .then(res => {
        if (res.ok) {
            notify.success('Tu mensaje ha sido enviado. Te contactaremos pronto', 'Contacto enviado', 4000);
            form.reset();
        } else {
            notify.error('Error al enviar el mensaje. Intenta más tarde', 'Error de envío', 4000);
        }
    });

// Actualización de perfil
if (passwordsMatch && passwordLength >= 8) {
    // Update password...
    notify.success('Tu contraseña ha sido actualizada correctamente', 'Cambio exitoso', 3000);
} else {
    notify.error('Las contraseñas no coinciden o son muy cortas', 'Validación fallida', 4000);
}


// ============================================
// EN DEVOLUCIONES (devoluciones-admin.js)
// ============================================

// Solicitar devolución
fetch('/api/solicitar-devolucion', {
    method: 'POST',
    body: JSON.stringify({ orderId, reason })
})
    .then(res => {
        if (res.ok) {
            notify.success('Tu solicitud de devolución ha sido recibida', 'Devolución registrada', 4000);
        } else {
            notify.error('No se pudo registrar la devolución. Contacta a soporte', 'Error', 4000);
        }
    });


// ============================================
// EN DESCUENTOS (descuentos.js)
// ============================================

// Aplicar código de descuento
if (codigoValido) {
    const ahorroFormato = (precioOriginal - precioConDescuento).toFixed(2);
    notify.success(`¡Descuento aplicado! Ahorras €${ahorroFormato}`, 'Código válido', 4000);
} else {
    notify.error('El código de descuento no es válido o ha expirado', 'Código inválido', 4000);
}


// ============================================
// EN SELECCIÓN DE TALLAS (modal-seleccionar-talla.js)
// ============================================

// Cuando se selecciona talla
notify.info('Talla seleccionada: ' + tallaSeleccionada, 'Confirmación', 2000);

// Error al agregar sin talla
notify.warning('Por favor selecciona una talla antes de continuar', 'Talla requerida', 4000);


// ============================================
// CONTROL AVANZADO
// ============================================

// Remover una notificación específica por ID
const notifId = notify.success('Este mensaje se cerrará en 2 segundos');
setTimeout(() => {
    notify.remove(notifId);
}, 2000);

// Limpiar todas las notificaciones
notify.clear();


// ============================================
// DURACIÓN PERSONALIZADA
// ============================================

// Notificación más larga (importante)
notify.error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente', 'Sesión expirada', 8000);

// Notificación muy breve (confirmación simple)
notify.success('Copiado al portapapeles', 'Éxito', 2000);

// Sin auto-cerrar (duración = 0)
notify.show('Esta notificación debe ser cerrada manualmente', 'info', 'Importante', 0);


// ============================================
// PERSONALIZACIÓN VISUAL (Tema Galiana)
// ============================================

// Para usar el tema dorado y burgundy de Galiana
// (Los estilos ya están incluidos, solo aplica las clases)

// En el HTML si necesitas personalizar:
// Éxito con tema Galiana: <div class="notification success galiana-success">
// Error con tema Galiana: <div class="notification error galiana-error">


// ============================================
// CASOS DE USO REALES DE TU TIENDA
// ============================================

// 1. Stock en tiempo real
async function validarYAgregarAlCarrito(producto) {
    const response = await fetch('/api/add-to-cart-validated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: producto.id, cantidad: 1 })
    });

    const data = await response.json();

    if (response.ok) {
        // Éxito ✓
        notify.success(
            `Ahora tienes ${data.cantidadEnCarrito} unidad(es) en el carrito`,
            'Producto agregado',
            3000
        );
        
        // Forzar actualización en otros usuarios
        window.forzarActualizacionStock();
        
    } else {
        // Error por stock
        notify.error(
            data.error || 'No hay stock disponible',
            'No disponible',
            4000
        );
    }
}

// 2. Validación de carrito antes de pagar
function validarCarritoPreCompra() {
    if (carrito.length === 0) {
        notify.warning('Tu carrito está vacío. Añade productos antes de comprar', 'Carrito vacío', 4000);
        return false;
    }

    const productosAgotados = carrito.filter(item => item.stock === 0);
    if (productosAgotados.length > 0) {
        const nombres = productosAgotados.map(p => p.nombre).join(', ');
        notify.error(`${nombres} ya no está disponible`, 'Productos agotados', 5000);
        return false;
    }

    notify.success('Carrito validado. Procede al checkout', 'Listo para comprar', 2000);
    return true;
}

// 3. Actualización de dirección de envío
async function guardarDireccionEnvio(direccion) {
    try {
        const response = await fetch('/api/update-address', {
            method: 'POST',
            body: JSON.stringify(direccion)
        });

        if (response.ok) {
            notify.success('Tu dirección ha sido actualizada correctamente', 'Guardado', 3000);
        } else {
            notify.error('Error al guardar la dirección. Intenta nuevamente', 'Error', 4000);
        }
    } catch (error) {
        notify.error('Conexión perdida. Intenta más tarde', 'Error de conexión', 5000);
    }
}
