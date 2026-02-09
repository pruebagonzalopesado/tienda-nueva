// Variables globales para devoluciones
let devolucionActual = null;

// Modal de confirmación profesional
function mostrarModalConfirmacion(titulo, mensaje, callback) {
    // Crear el modal dinámicamente
    let modal = document.getElementById('modal-confirmacion-global');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-confirmacion-global';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 2000;
            align-items: center;
            justify-content: center;
        `;
        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; max-width: 400px; width: 90%; padding: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 id="modal-confirm-titulo" style="margin: 0 0 1rem 0; color: #333;"></h3>
                <p id="modal-confirm-mensaje" style="margin: 0 0 2rem 0; color: #666; line-height: 1.5;"></p>
                <div style="display: flex; gap: 1rem;">
                    <button onclick="cancelarModalConfirmacion()" style="flex: 1; padding: 0.75rem 1rem; background: #ddd; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Cancelar
                    </button>
                    <button id="btn-confirm-si" onclick="confirmarModalConfirmacion()" style="flex: 1; padding: 0.75rem 1rem; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Confirmar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('modal-confirm-titulo').textContent = titulo;
    document.getElementById('modal-confirm-mensaje').textContent = mensaje;
    modal.style.display = 'flex';
    
    window.callbackConfirmacion = callback;
}

function confirmarModalConfirmacion() {
    document.getElementById('modal-confirmacion-global').style.display = 'none';
    if (window.callbackConfirmacion) {
        window.callbackConfirmacion(true);
        window.callbackConfirmacion = null;
    }
}

function cancelarModalConfirmacion() {
    document.getElementById('modal-confirmacion-global').style.display = 'none';
    window.callbackConfirmacion = null;
}

// Modal de notificación/éxito
function mostrarModalNotificacion(titulo, mensaje, tipo = 'exito') {
    let modal = document.getElementById('modal-notificacion-global');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-notificacion-global';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 2000;
            align-items: center;
            justify-content: center;
        `;
        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; max-width: 400px; width: 90%; padding: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                <h3 id="modal-notif-titulo" style="margin: 0 0 1rem 0; color: #333;"></h3>
                <p id="modal-notif-mensaje" style="margin: 0 0 1.5rem 0; color: #666; line-height: 1.5;"></p>
                <button onclick="cerrarModalNotificacion()" style="padding: 0.75rem 2rem; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    Aceptar
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const colores = {
        'exito': '#28a745',
        'error': '#f44336',
        'info': '#2196f3'
    };
    
    const titulo_elem = document.getElementById('modal-notif-titulo');
    titulo_elem.textContent = titulo;
    titulo_elem.style.color = colores[tipo] || colores['info'];
    
    document.getElementById('modal-notif-mensaje').textContent = mensaje;
    modal.style.display = 'flex';
}

function cerrarModalNotificacion() {
    document.getElementById('modal-notificacion-global').style.display = 'none';
}

// Cargar devoluciones al cambiar de sección
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (link.getAttribute('data-section') === 'devoluciones') {
                setTimeout(cargarDevoluciones, 100);
            }
        });
    });

    // Event listeners para filtros
    const searchDevoluciones = document.getElementById('search-devoluciones');
    const filterEstado = document.getElementById('filter-devolucion-estado');
    
    if (searchDevoluciones) {
        searchDevoluciones.addEventListener('keyup', cargarDevoluciones);
    }
    if (filterEstado) {
        filterEstado.addEventListener('change', cargarDevoluciones);
    }
});

async function cargarDevoluciones() {
    try {
        const response = await fetch('/api/admin/manage-returns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'listar' })
        });

        const data = await response.json();
        if (!data.success) throw new Error('Error al cargar devoluciones');

        let devoluciones = data.devoluciones || [];

        // Aplicar filtros
        const searchTerm = document.getElementById('search-devoluciones')?.value.toLowerCase() || '';
        const estadoFilter = document.getElementById('filter-devolucion-estado')?.value || '';

        if (searchTerm) {
            devoluciones = devoluciones.filter(d =>
                d.usuario_email.toLowerCase().includes(searchTerm) ||
                d.pedido_id.toString().includes(searchTerm)
            );
        }

        if (estadoFilter) {
            devoluciones = devoluciones.filter(d => d.estado === estadoFilter);
        }

        renderizarDevoluciones(devoluciones);
    } catch (error) {
        console.error('Error cargando devoluciones:', error);
        document.getElementById('devoluciones-tbody').innerHTML = `
            <tr><td colspan="6" style="text-align: center; padding: 2rem; color: #d32f2f;">Error al cargar devoluciones</td></tr>
        `;
    }
}

function renderizarDevoluciones(devoluciones) {
    const tbody = document.getElementById('devoluciones-tbody');
    
    if (!devoluciones || devoluciones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No hay devoluciones</td></tr>';
        return;
    }

    const estadoBadges = {
        'procesado': '<span style="background: #fff3cd; color: #856404; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">Procesado</span>',
        'confirmada': '<span style="background: #d1ecf1; color: #0c5460; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">Confirmada</span>',
        'rechazada': '<span style="background: #f8d7da; color: #842029; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">Rechazada</span>'
    };

    tbody.innerHTML = devoluciones.map(dev => {
        const fechaFormato = new Date(dev.created_at).toLocaleDateString('es-ES');

        return `
            <tr style="border-bottom: 1px solid #e0e0e0;">
                <td style="padding: 1rem; text-align: left;">${dev.id}</td>
                <td style="padding: 1rem; text-align: left; color: #d4af37; font-weight: bold;">#${dev.pedido_id}</td>
                <td style="padding: 1rem; text-align: left; font-size: 0.9rem;">${dev.usuario_email}</td>
                <td style="padding: 1rem; text-align: left;">${estadoBadges[dev.estado] || dev.estado}</td>
                <td style="padding: 1rem; text-align: left; font-size: 0.9rem;">${fechaFormato}</td>
                <td style="padding: 1rem; text-align: center;">
                    <button onclick='abrirDevolucion(${JSON.stringify(dev).replace(/'/g, "&apos;")})' 
                            style="background: #2196f3; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: bold;">
                        Gestionar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function abrirDevolucion(devolucion) {
    devolucionActual = devolucion;
    
    document.getElementById('modal-dev-id').textContent = `#${devolucion.id}`;
    document.getElementById('dev-id').textContent = devolucion.id;
    document.getElementById('dev-pedido-id').textContent = `#${devolucion.pedido_id}`;
    document.getElementById('dev-cliente').textContent = devolucion.usuario_nombre;
    document.getElementById('dev-email').textContent = devolucion.usuario_email;
    document.getElementById('dev-motivo').textContent = devolucion.motivo_solicitud;
    
    // Mostrar el monto de la devolución (no el total del pedido)
    const montoReembolso = devolucion.monto_reembolso || devolucion.pedidos?.total || 0;
    document.getElementById('dev-monto').textContent = `€${parseFloat(montoReembolso).toFixed(2)}`;
    
    // Mostrar los items devueltos
    const itemsDevueltos = devolucion.items_devueltos || [];
    const itemsContainer = document.getElementById('dev-items-devueltos');
    
    if (itemsContainer) {
        if (itemsDevueltos.length > 0) {
            itemsContainer.innerHTML = itemsDevueltos.map(item => `
                <div style="padding: 0.75rem; background: white; border: 1px solid #e0e0e0; border-radius: 4px; margin-bottom: 0.5rem;">
                    <div style="font-weight: 600; color: #333;">${item.nombre} ${item.talla ? `(Talla: ${item.talla})` : ''}</div>
                    <div style="font-size: 0.9rem; color: #666;">
                        ${item.cantidad}x @ €${parseFloat(item.precio).toFixed(2)} = €${parseFloat(item.subtotal || item.cantidad * item.precio).toFixed(2)}
                    </div>
                </div>
            `).join('');
        } else {
            itemsContainer.innerHTML = '<p style="color: #999;">No hay items seleccionados</p>';
        }
    }
    
    const estadoTexto = {
        'procesado': 'Procesado (Pendiente de revisar)',
        'confirmada': 'Confirmada',
        'rechazada': 'Rechazada'
    };
    document.getElementById('dev-estado-actual').textContent = estadoTexto[devolucion.estado] || devolucion.estado;

    // Mostrar/ocultar acciones según estado
    const acciones = document.getElementById('dev-acciones');
    if (devolucion.estado === 'procesado') {
        acciones.style.display = 'flex';
    } else {
        acciones.style.display = 'none';
    }

    // Limpiar modal de rechazo
    cerrarModalRechazo();

    document.getElementById('modal-devolucion').style.display = 'flex';
}

function cerrarModalDevolucion() {
    document.getElementById('modal-devolucion').style.display = 'none';
    devolucionActual = null;
}

async function confirmarDevolucion() {
    if (!devolucionActual) return;

    mostrarModalConfirmacion(
        'Confirmar Devolución',
        'Se procesará el reembolso automáticamente y se enviará un email de confirmación al cliente. ¿Deseas continuar?',
        async (confirmado) => {
            if (!confirmado) return;

            try {
                const response = await fetch('/api/admin/manage-returns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        devolucionId: devolucionActual.id,
                        action: 'confirmar'
                    })
                });

                const data = await response.json();
                if (data.success) {
                    mostrarModalNotificacion(
                        'Devolución Confirmada',
                        'Se ha procesado el reembolso y se envió un email de confirmación al cliente.',
                        'exito'
                    );
                    setTimeout(() => {
                        cerrarModalDevolucion();
                        cargarDevoluciones();
                    }, 1500);
                } else {
                    mostrarModalNotificacion(
                        'Error',
                        'Error: ' + data.message,
                        'error'
                    );
                }
            } catch (error) {
                console.error('Error:', error);
                mostrarModalNotificacion(
                    'Error',
                    'Error al procesar la confirmación',
                    'error'
                );
            }
        }
    );
}

function abrirModalRechazo() {
    document.getElementById('modal-rechazo').style.display = 'block';
    document.getElementById('motivo-rechazo').focus();
}

function cerrarModalRechazo() {
    document.getElementById('modal-rechazo').style.display = 'none';
    document.getElementById('motivo-rechazo').value = '';
}

async function enviarRechazo() {
    if (!devolucionActual) return;

    const motivo = document.getElementById('motivo-rechazo').value.trim();
    if (!motivo) {
        mostrarModalNotificacion(
            'Atención',
            'Por favor, ingresa un motivo de rechazo',
            'info'
        );
        return;
    }

    mostrarModalConfirmacion(
        'Confirmar Rechazo',
        'Se rechazará esta devolución y se enviará una notificación al cliente con el motivo del rechazo. ¿Deseas continuar?',
        async (confirmado) => {
            if (!confirmado) return;

            try {
                const response = await fetch('/api/admin/manage-returns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        devolucionId: devolucionActual.id,
                        action: 'rechazar',
                        motivo_rechazo: motivo
                    })
                });

                const data = await response.json();
                if (data.success) {
                    mostrarModalNotificacion(
                        'Devolución Rechazada',
                        'Se ha rechazado la devolución y se envió un email de notificación al cliente.',
                        'exito'
                    );
                    setTimeout(() => {
                        cerrarModalDevolucion();
                        cargarDevoluciones();
                    }, 1500);
                } else {
                    mostrarModalNotificacion(
                        'Error',
                        'Error: ' + data.message,
                        'error'
                    );
                }
            } catch (error) {
                console.error('Error:', error);
                mostrarModalNotificacion(
                    'Error',
                    'Error al procesar el rechazo',
                    'error'
                );
            }
        }
    );
}
