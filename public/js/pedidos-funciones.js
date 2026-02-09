// Funciones para la sección de Pedidos del Panel Admin

let paginaActual = 1;
const itemsPorPagina = 10;
let pedidoActualDetalle = null;
let filtroEstado = '';
let filtroBusqueda = '';

// Cargar pedidos
async function cargarPedidos(pagina = 1) {
    paginaActual = pagina;
    const offset = (pagina - 1) * itemsPorPagina;

    try {
        const url = new URL('/api/admin/get-pedidos', window.location.origin);
        url.searchParams.append('page', pagina.toString());
        url.searchParams.append('pageSize', itemsPorPagina.toString());

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error('Error al cargar pedidos');
        }

        const data = await response.json();
        let pedidos = data.pedidos || [];

        // Filtrar por búsqueda
        if (filtroBusqueda) {
            pedidos = pedidos.filter(p =>
                p.email.toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
                p.id.toString().includes(filtroBusqueda)
            );
        }

        // Filtrar por estado
        if (filtroEstado) {
            pedidos = pedidos.filter(p => p.estado === filtroEstado);
        }

        renderizarPedidos(pedidos, data.total);
        renderizarPaginacion(Math.ceil(data.total / itemsPorPagina));
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('pedidos-tbody').innerHTML = `
            <tr>
                <td colspan="7" class="loading">Error al cargar pedidos</td>
            </tr>
        `;
    }
}

// Renderizar tabla de pedidos
function renderizarPedidos(pedidos, total) {
    const tbody = document.getElementById('pedidos-tbody');

    if (pedidos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-pedidos">No se encontraron pedidos</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pedidos.map(pedido => `
        <tr>
            <td><span class="pedido-id" data-pedido-id="${pedido.id}">${pedido.id}</span></td>
            <td class="col-cliente">${pedido.nombre || '-'}</td>
            <td class="col-email">${pedido.email || '-'}</td>
            <td>€${parseFloat(pedido.total || 0).toFixed(2)}</td>
            <td><span class="estado-badge estado-${pedido.estado}">${capitalizar(pedido.estado)}</span></td>
            <td class="col-fecha">${formatearFecha(pedido.fecha_creacion)}</td>
            <td>
                <button class="btn-principal btn-ver-pedido" data-pedido-id="${pedido.id}" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                    Ver
                </button>
            </td>
        </tr>
    `).join('');
    
    // Event delegation para los botones Ver
    document.querySelectorAll('.btn-ver-pedido').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pedidoId = e.target.closest('button').getAttribute('data-pedido-id');
            abrirDetalles(pedidoId);
        });
    });
    
    // Event delegation para los IDs de pedido
    document.querySelectorAll('.pedido-id[data-pedido-id]').forEach(span => {
        span.addEventListener('click', (e) => {
            const pedidoId = e.target.getAttribute('data-pedido-id');
            abrirDetalles(pedidoId);
        });
    });
}

// Renderizar paginación
function renderizarPaginacion(totalPaginas) {
    const container = document.getElementById('pagination');

    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = '';

    // Botón anterior
    if (paginaActual > 1) {
        const btnAnterior = document.createElement('button');
        btnAnterior.textContent = '← Anterior';
        btnAnterior.style.cssText = 'padding: 0.75rem 1.5rem; background: #d4af37; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
        btnAnterior.onclick = () => cargarPedidos(paginaActual - 1);
        container.appendChild(btnAnterior);
    }

    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        const btnPage = document.createElement('button');
        btnPage.textContent = i;
        
        if (i === paginaActual) {
            btnPage.style.cssText = 'padding: 0.75rem 1rem; background: #d4af37; color: white; border: 2px solid #d4af37; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
        } else {
            btnPage.style.cssText = 'padding: 0.75rem 1rem; background: white; color: #d4af37; border: 2px solid #d4af37; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
            btnPage.onclick = () => cargarPedidos(i);
        }
        
        container.appendChild(btnPage);
    }

    // Botón siguiente
    if (paginaActual < totalPaginas) {
        const btnSiguiente = document.createElement('button');
        btnSiguiente.textContent = 'Siguiente →';
        btnSiguiente.style.cssText = 'padding: 0.75rem 1.5rem; background: #d4af37; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
        btnSiguiente.onclick = () => cargarPedidos(paginaActual + 1);
        container.appendChild(btnSiguiente);
    }
}

// Abrir detalles del pedido
async function abrirDetalles(pedidoId) {
    try {
        const response = await fetch(`/api/admin/get-pedido-detalle?id=${pedidoId}`);
        if (!response.ok) {
            alert('Error al cargar los detalles del pedido');
            return;
        }

        const pedido = await response.json();
        pedidoActualDetalle = pedido;
        
        console.log('Datos del pedido cargados:', pedido);
        console.log('Productos en el pedido:', pedido.productos);
        console.log('Items en el pedido:', pedido.items);

        // Llenar modal (con validaciones)
        const modalIdEl = document.getElementById('modal-pedido-id');
        if (modalIdEl) modalIdEl.textContent = pedido.id;
        
        const nombreEl = document.getElementById('detalle-nombre');
        if (nombreEl) nombreEl.textContent = pedido.nombre_cliente || pedido.nombre || '-';
        
        const emailEl = document.getElementById('detalle-email');
        if (emailEl) emailEl.textContent = pedido.email || '-';
        
        const telefonoEl = document.getElementById('detalle-telefono');
        if (telefonoEl) telefonoEl.textContent = pedido.telefono || '-';
        
        const ciudadEl = document.getElementById('detalle-ciudad');
        if (ciudadEl) ciudadEl.textContent = pedido.ciudad || '-';
        
        const direccionEl = document.getElementById('detalle-direccion');
        if (direccionEl) direccionEl.textContent = pedido.direccion || '-';
        
        const codigoEl = document.getElementById('detalle-codigo-postal');
        if (codigoEl) codigoEl.textContent = pedido.codigo_postal || '-';
        
        const paisEl = document.getElementById('detalle-pais');
        if (paisEl) paisEl.textContent = pedido.pais || '-';
        
        const fechaEl = document.getElementById('detalle-fecha');
        if (fechaEl) fechaEl.textContent = formatearFecha(pedido.fecha_creacion);
        
        const metodoEl = document.getElementById('detalle-metodo-pago');
        if (metodoEl) metodoEl.textContent = capitalizar(pedido.metodo_pago || '-');
        
        const stripeEl = document.getElementById('detalle-stripe-id');
        if (stripeEl) stripeEl.textContent = pedido.stripe_session_id ? pedido.stripe_session_id.substring(0, 20) + '...' : '-';

        // Renderizar productos
        const productosDiv = document.getElementById('detalle-productos');
        
        // Usar 'productos' si existe, sino intentar con 'items'
        const listaProductos = pedido.productos || pedido.items || [];
        
        console.log('Lista de productos a renderizar:', listaProductos);
        
        if (listaProductos && listaProductos.length > 0) {
            productosDiv.innerHTML = `
                <div style="border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;">
                    <div style="background: #f5f5f5; padding: 1rem; border-bottom: 1px solid #e0e0e0;">
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 1rem; font-weight: 600; color: #333; font-size: 0.9rem;">
                            <div>Producto</div>
                            <div style="text-align: center;">Referencia</div>
                            <div style="text-align: center;">Talla</div>
                            <div style="text-align: center;">Cantidad</div>
                            <div style="text-align: right;">Precio</div>
                        </div>
                    </div>
                    ${listaProductos.map(prod => {
                        console.log('Procesando producto:', prod, 'Referencia:', prod.referencia, 'Talla:', prod.talla);
                        return `
                        <div style="padding: 1rem; border-bottom: 1px solid #e0e0e0; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 1rem; align-items: center;">
                            <div style="font-weight: 600; color: #333;">${prod.nombre}</div>
                            <div style="text-align: center; color: #666; font-size: 0.9rem; font-family: monospace; background: #f9f9f9; padding: 0.5rem; border-radius: 4px;">${prod.referencia || 'N/A'}</div>
                            <div style="text-align: center; color: #666; font-size: 0.9rem; background: ${prod.talla ? '#f0f0f0' : 'transparent'}; padding: 0.5rem; border-radius: 4px;">${prod.talla ? `<strong>${prod.talla}</strong>` : '-'}</div>
                            <div style="text-align: center; color: #666;">${prod.cantidad}x</div>
                            <div style="text-align: right; font-weight: 600; color: #d4af37;">€${parseFloat(prod.subtotal || prod.precio * prod.cantidad).toFixed(2)}</div>
                        </div>
                    `;
                    }).join('')}
                </div>
            `;
        } else {
            productosDiv.innerHTML = '<div style="background: #f9f9f9; padding: 1.5rem; text-align: center; color: #999; border-radius: 6px;">Sin productos</div>';
        }

        // Resumen económico
        const subtotalEl = document.getElementById('detalle-subtotal') || document.getElementById('resumen-subtotal');
        if (subtotalEl) subtotalEl.textContent = '€' + parseFloat(pedido.subtotal || 0).toFixed(2);
        
        const envioEl = document.getElementById('detalle-envio') || document.getElementById('resumen-envio');
        if (envioEl) envioEl.textContent = '€' + parseFloat(pedido.envio || 0).toFixed(2);
        
        const totalEl = document.getElementById('detalle-total') || document.getElementById('resumen-total');
        if (totalEl) totalEl.textContent = '€' + parseFloat(pedido.total || 0).toFixed(2);

        // Mostrar descuento si existe
        const descuentoEl = document.getElementById('detalle-descuento') || document.getElementById('resumen-descuento');
        const descuentoRow = document.getElementById('resumen-descuento-row');
        if (pedido.descuento && pedido.descuento > 0) {
            if (descuentoEl) descuentoEl.textContent = '-€' + parseFloat(pedido.descuento).toFixed(2);
            if (descuentoRow) descuentoRow.style.display = 'flex';
        } else {
            if (descuentoRow) descuentoRow.style.display = 'none';
        }

        // Establecer estado actual
        const estadoSelect = document.getElementById('detalle-estado') || document.getElementById('select-estado');
        if (estadoSelect) estadoSelect.value = pedido.estado || 'pendiente';

        // Mostrar modal
        const modal = document.getElementById('modal-detalle');
        if (modal) {
            modal.classList.add('active');
            // Bloquear scroll de la página
            document.body.style.overflow = 'hidden';
            
            // Cerrar modal al hacer click fuera
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cerrarModal();
                }
            });
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar los detalles del pedido');
    }
}

// Cerrar modal
function cerrarModal() {
    const modal = document.getElementById('modal-detalle');
    if (modal) {
        modal.classList.remove('active');
        // Restaurar scroll de la página
        document.body.style.overflow = '';
    }
    pedidoActualDetalle = null;
}

// Actualizar estado del pedido
async function actualizarEstadoPedido() {
    if (!pedidoActualDetalle) return;

    const estadoSelect = document.getElementById('detalle-estado') || document.getElementById('select-estado');
    if (!estadoSelect) return;
    
    const nuevoEstado = estadoSelect.value;

    try {
        const response = await fetch('/api/admin/update-pedido-estado', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pedidoId: pedidoActualDetalle.id,
                estado: nuevoEstado
            })
        });

        if (!response.ok) {
            throw new Error('Error al actualizar el pedido');
        }

        mostrarNotificacion('Estado del pedido actualizado correctamente', 'success');
        cerrarModal();
        cargarPedidos(paginaActual);
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error al actualizar el estado del pedido', 'error');
    }
}

// Inicializar filtros cuando cargue la página
document.addEventListener('DOMContentLoaded', () => {
    // Búsqueda
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filtroBusqueda = e.target.value;
            cargarPedidos(1);
        });
    }

    // Filtro por estado
    const filterEstado = document.getElementById('filter-estado');
    if (filterEstado) {
        filterEstado.addEventListener('change', (e) => {
            filtroEstado = e.target.value;
            cargarPedidos(1);
        });
    }

    // Cerrar modal al hacer clic fuera
    const modal = document.getElementById('modal-detalle');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cerrarModal();
            }
        });
    }
});

// Descargar factura del pedido
async function descargarFactura() {
    if (!pedidoActualDetalle) {
        alert('No hay pedido seleccionado');
        return;
    }

    try {
        console.log('[pedidos-funciones] Descargando factura para pedido:', pedidoActualDetalle.id);
        
        const response = await fetch(`/api/admin/download-invoice?id=${pedidoActualDetalle.id}`);
        
        if (!response.ok) {
            throw new Error('Error al descargar la factura');
        }

        // Crear blob y descargar
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factura_${pedidoActualDetalle.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('[pedidos-funciones] ✅ Factura descargada exitosamente');
    } catch (error) {
        console.error('[pedidos-funciones] Error al descargar factura:', error);
        alert('Error al descargar la factura');
    }
}

// Funciones auxiliares
function formatearFecha(fecha) {
    if (!fecha) return '-';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function capitalizar(texto) {
    if (!texto) return '-';
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}
