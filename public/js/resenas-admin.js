let productoSeleccionadoResenas = null;

// Cargar productos con reseñas cuando la sección esté visible
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const section = this.dataset.section;
            if (section === 'resenas') {
                cargarProductosConResenas();
            }
        });
    });
});

async function cargarProductosConResenas() {
    try {
        console.log('[resenas] Cargando productos con reseñas...');
        
        // Obtener todas las reseñas agrupadas por product_id
        const { data: resenas, error } = await window.supabaseClient
            .from('resenas')
            .select('product_id');

        if (error) throw error;

        // Obtener IDs únicos
        const productIds = [...new Set(resenas.map(r => r.product_id))];
        
        if (productIds.length === 0) {
            document.getElementById('lista-productos-resenas').innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #999;">No hay reseñas de productos</td></tr>';
            return;
        }

        // Obtener detalles de los productos
        const { data: productos, error: prodError } = await window.supabaseClient
            .from('products')
            .select('id, nombre, imagen_url')
            .in('id', productIds);

        if (prodError) throw prodError;

        // Para cada producto, contar cuántas reseñas tiene
        const productosConConteo = [];
        for (const producto of productos) {
            const conteo = resenas.filter(r => r.product_id === producto.id).length;
            
            // Parsear imagen_url si es un array JSON
            let imagenUrl = null;
            if (producto.imagen_url) {
                try {
                    // Si es un string que comienza con [, es un array JSON
                    if (typeof producto.imagen_url === 'string' && producto.imagen_url.startsWith('[')) {
                        const imagenes = JSON.parse(producto.imagen_url);
                        imagenUrl = imagenes[0] || null;
                    } else {
                        imagenUrl = producto.imagen_url;
                    }
                } catch (e) {
                    imagenUrl = producto.imagen_url;
                }
            }
            
            console.log('[resenas] Producto:', { id: producto.id, nombre: producto.nombre, imagen_url_final: imagenUrl });
            
            productosConConteo.push({
                ...producto,
                imagen_url: imagenUrl,
                resenasCount: conteo
            });
        }

        // Renderizar lista de productos
        const container = document.getElementById('lista-productos-resenas');
        container.innerHTML = '';
        
        productosConConteo.forEach((producto, index) => {
            const nombreEscapado = producto.nombre.replace(/'/g, "\\'");
            
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e0e0e0';
            
            // Celda de imagen
            const tdImagen = document.createElement('td');
            tdImagen.style.textAlign = 'center';
            tdImagen.style.padding = '0.5rem';
            tdImagen.style.verticalAlign = 'middle';
            
            if (producto.imagen_url) {
                const img = document.createElement('img');
                img.src = producto.imagen_url;
                img.alt = producto.nombre;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '90px';
                img.style.objectFit = 'contain';
                img.style.borderRadius = '4px';
                img.onerror = function() {
                    this.replaceWith(document.createTextNode('Sin imagen'));
                };
                tdImagen.appendChild(img);
            } else {
                tdImagen.innerHTML = '<div style="width: 100%; height: 90px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 0.8rem;">Sin imagen</div>';
            }
            
            // Celda de nombre
            const tdNombre = document.createElement('td');
            tdNombre.style.padding = '1rem';
            tdNombre.style.verticalAlign = 'middle';
            tdNombre.innerHTML = `<strong>${producto.nombre}</strong>`;
            
            // Celda de reseñas
            const tdResenas = document.createElement('td');
            tdResenas.style.textAlign = 'center';
            tdResenas.style.padding = '1rem';
            tdResenas.style.verticalAlign = 'middle';
            tdResenas.innerHTML = `<span style="background: #d4af37; color: white; padding: 0.4rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">${producto.resenasCount}</span>`;
            
            // Celda de acción
            const tdAccion = document.createElement('td');
            tdAccion.style.textAlign = 'center';
            tdAccion.style.padding = '1rem';
            tdAccion.style.verticalAlign = 'middle';
            const btn = document.createElement('button');
            btn.textContent = 'Ver Reseñas';
            btn.style.background = '#d4af37';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.padding = '0.5rem 1rem';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.style.fontWeight = '600';
            btn.onclick = () => seleccionarProductoResenas(producto.id, producto.nombre);
            tdAccion.appendChild(btn);
            
            tr.appendChild(tdImagen);
            tr.appendChild(tdNombre);
            tr.appendChild(tdResenas);
            tr.appendChild(tdAccion);
            
            // Hacer la fila clickeable (especialmente en móvil)
            tr.onclick = (e) => {
                // No ejecutar si se clickea en el botón
                if (e.target.tagName !== 'BUTTON') {
                    seleccionarProductoResenas(producto.id, producto.nombre);
                }
            };
            
            container.appendChild(tr);
        });

    } catch (error) {
        console.error('[resenas] Error cargando productos:', error);
        document.getElementById('lista-productos-resenas').innerHTML = '<p style="grid-column: 1/-1; color: red;">Error cargando productos: ' + error.message + '</p>';
    }
}

async function seleccionarProductoResenas(productId, productName) {
    try {
        console.log('[resenas] Seleccionando producto:', productId);
        
        productoSeleccionadoResenas = { id: productId, nombre: productName };
        
        // Mostrar vista de reseñas
        document.getElementById('contenedor-productos-resenas').style.display = 'none';
        document.getElementById('vista-resenas').style.display = 'block';
        document.getElementById('titulo-resenas-producto').textContent = `Reseñas de: ${productName}`;

        // Cargar reseñas del producto
        const { data: resenas, error } = await window.supabaseClient
            .from('resenas')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Renderizar tabla de reseñas
        const tbody = document.getElementById('resenas-tbody');
        
        if (!resenas || resenas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #999;">No hay reseñas para este producto</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        resenas.forEach(resena => {
            const fecha = new Date(resena.created_at).toLocaleDateString('es-ES');
            const estrellas = '★'.repeat(resena.calificacion) + '☆'.repeat(5 - resena.calificacion);
            
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.style.borderBottom = '1px solid #e0e0e0';
            tr.onclick = () => abrirModalResena(resena);
            tr.onmouseover = () => tr.style.background = '#fafafa';
            tr.onmouseout = () => tr.style.background = '';
            
            const tdUsuario = document.createElement('td');
            tdUsuario.style.padding = '0.8rem';
            tdUsuario.style.fontSize = '0.9rem';
            tdUsuario.innerHTML = `<strong>${resena.usuario_nombre || 'Anónimo'}</strong>`;
            
            const tdCalificacion = document.createElement('td');
            tdCalificacion.style.textAlign = 'center';
            tdCalificacion.style.padding = '0.8rem';
            tdCalificacion.innerHTML = `<span style="color: #d4af37; font-weight: 600;">${estrellas}</span>`;
            
            const tdTitulo = document.createElement('td');
            tdTitulo.style.padding = '0.8rem';
            tdTitulo.style.fontSize = '0.9rem';
            tdTitulo.style.maxWidth = '150px';
            tdTitulo.style.overflow = 'hidden';
            tdTitulo.style.textOverflow = 'ellipsis';
            tdTitulo.style.whiteSpace = 'nowrap';
            tdTitulo.textContent = resena.titulo || '-';
            
            const tdComentario = document.createElement('td');
            tdComentario.style.padding = '0.8rem';
            tdComentario.style.fontSize = '0.85rem';
            tdComentario.style.maxWidth = '200px';
            tdComentario.style.overflow = 'hidden';
            tdComentario.style.textOverflow = 'ellipsis';
            tdComentario.style.whiteSpace = 'nowrap';
            tdComentario.textContent = resena.comentario || '-';
            
            const tdFecha = document.createElement('td');
            tdFecha.style.padding = '0.8rem';
            tdFecha.style.fontSize = '0.85rem';
            tdFecha.style.color = '#666';
            tdFecha.textContent = fecha;
            
            const tdAcciones = document.createElement('td');
            tdAcciones.style.padding = '0.8rem';
            tdAcciones.style.textAlign = 'center';
            const btn = document.createElement('button');
            btn.textContent = 'Eliminar';
            btn.style.background = '#ff4444';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.padding = '0.4rem 0.8rem';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '0.85rem';
            btn.style.whiteSpace = 'nowrap';
            btn.onclick = (e) => {
                e.stopPropagation();
                eliminarResena(resena.id);
            };
            tdAcciones.appendChild(btn);
            
            tr.appendChild(tdUsuario);
            tr.appendChild(tdCalificacion);
            tr.appendChild(tdTitulo);
            tr.appendChild(tdComentario);
            tr.appendChild(tdFecha);
            tr.appendChild(tdAcciones);
            
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('[resenas] Error seleccionando producto:', error);
        alert('Error cargando reseñas: ' + error.message);
    }
}

function volverAProductos() {
    document.getElementById('contenedor-productos-resenas').style.display = 'block';
    document.getElementById('vista-resenas').style.display = 'none';
    productoSeleccionadoResenas = null;
}

async function eliminarResena(resenaId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta reseña?')) {
        return;
    }

    try {
        console.log('[resenas] Eliminando reseña:', resenaId);
        
        const { error } = await window.supabaseClient
            .from('resenas')
            .delete()
            .eq('id', resenaId);

        if (error) throw error;

        // Recargar reseñas del producto
        if (productoSeleccionadoResenas) {
            await seleccionarProductoResenas(productoSeleccionadoResenas.id, productoSeleccionadoResenas.nombre);
        }

        alert('Reseña eliminada exitosamente');
    } catch (error) {
        console.error('[resenas] Error eliminando reseña:', error);
        alert('Error al eliminar la reseña: ' + error.message);
    }
}
function abrirModalResena(resena) {
    console.log('[resenas] Abriendo modal de reseña:', resena);
    
    // Llenar datos del modal
    document.getElementById('modal-resena-usuario').textContent = resena.usuario_nombre || 'Anónimo';
    
    const estrellas = '★'.repeat(resena.calificacion) + '☆'.repeat(5 - resena.calificacion);
    document.getElementById('modal-resena-calificacion').textContent = estrellas;
    
    document.getElementById('modal-resena-titulo').textContent = resena.titulo || '-';
    document.getElementById('modal-resena-comentario').textContent = resena.comentario || '-';
    
    const fecha = new Date(resena.created_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('modal-resena-fecha').textContent = fecha;
    
    // Configurar botón eliminar
    const btnEliminar = document.getElementById('btn-eliminar-resena-modal');
    btnEliminar.onclick = () => {
        cerrarModalResena();
        eliminarResena(resena.id);
    };
    
    // Mostrar modal
    document.getElementById('modal-resena-detalle').style.display = 'flex';
}

function cerrarModalResena() {
    document.getElementById('modal-resena-detalle').style.display = 'none';
}

// Cerrar modal al hacer clic fuera del contenido
document.addEventListener('DOMContentLoaded', function() {
    const modalResena = document.getElementById('modal-resena-detalle');
    if (modalResena) {
        modalResena.addEventListener('click', function(e) {
            if (e.target === modalResena) {
                cerrarModalResena();
            }
        });
    }
});