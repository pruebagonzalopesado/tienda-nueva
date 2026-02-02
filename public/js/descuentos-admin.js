// ===== FUNCIONES PARA GESTIONAR DESCUENTOS =====

// Abrir formulario para crear descuento
function abrirFormularioDescuento() {
    document.getElementById('formulario-descuento').style.display = 'block';
    document.getElementById('descuento-titulo').textContent = 'Crear Código de Descuento';
    document.getElementById('form-descuento').reset();
    document.getElementById('desc-codigo').focus();
}

// Cerrar formulario de descuento
function cerrarFormularioDescuento() {
    document.getElementById('formulario-descuento').style.display = 'none';
    document.getElementById('form-descuento').reset();
}

// Guardar descuento
async function guardarDescuento(event) {
    event.preventDefault();
    
    try {
        const codigo = document.getElementById('desc-codigo').value.toUpperCase();
        const porcentaje = parseFloat(document.getElementById('desc-porcentaje').value);
        const usosMax = parseInt(document.getElementById('desc-usos-max').value) || 0;
        const fechaFin = document.getElementById('desc-fecha-fin').value || null;
        const descripcion = document.getElementById('desc-descripcion').value;
        const activo = document.getElementById('desc-activo').checked;
        
        // Validaciones
        if (!codigo || porcentaje <= 0 || porcentaje > 100) {
            alert('Por favor completa todos los campos correctamente');
            return;
        }
        
        const descuentoId = document.getElementById('form-descuento').dataset.id;
        
        if (descuentoId) {
            // Actualizar descuento existente
            const { error } = await supabaseClient
                .from('descuentos')
                .update({
                    codigo,
                    porcentaje,
                    usos_maximos: usosMax,
                    fecha_fin: fechaFin,
                    descripcion,
                    activo,
                    updated_at: new Date()
                })
                .eq('id', descuentoId);
            
            if (error) throw error;
            alert('Descuento actualizado correctamente');
        } else {
            // Crear nuevo descuento
            const { error } = await supabaseClient
                .from('descuentos')
                .insert([{
                    codigo,
                    porcentaje,
                    usos_maximos: usosMax,
                    usos_actuales: 0,
                    fecha_fin: fechaFin,
                    descripcion,
                    activo
                }]);
            
            if (error) {
                if (error.message.includes('unique')) {
                    alert('Este código de descuento ya existe');
                } else {
                    throw error;
                }
                return;
            }
            alert('Descuento creado correctamente');
        }
        
        cerrarFormularioDescuento();
        cargarDescuentos();
        
    } catch (error) {
        console.error('Error guardando descuento:', error);
        alert('Error al guardar el descuento: ' + error.message);
    }
}

// Cargar todos los descuentos
async function cargarDescuentos() {
    try {
        const { data: descuentos, error } = await supabaseClient
            .from('descuentos')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        mostrarDescuentos(descuentos || []);
        
    } catch (error) {
        console.error('Error cargando descuentos:', error);
        document.getElementById('descuentos-tbody').innerHTML = `
            <tr>
                <td colspan="8" class="loading">Error al cargar descuentos</td>
            </tr>
        `;
    }
}

// Mostrar descuentos en la tabla
function mostrarDescuentos(descuentos) {
    const tbody = document.getElementById('descuentos-tbody');
    
    if (descuentos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="loading">No hay descuentos registrados</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = descuentos.map(d => {
        const disponible = d.usos_maximos === 0 ? '∞' : (d.usos_maximos - d.usos_actuales);
        const estaDisponible = d.usos_maximos === 0 || d.usos_actuales < d.usos_maximos;
        const noVencido = !d.fecha_fin || new Date(d.fecha_fin) > new Date();
        const puedeUsarse = d.activo && estaDisponible && noVencido;
        
        const fechaFin = d.fecha_fin ? new Date(d.fecha_fin).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }) : '-';
        
        return `
            <tr>
                <td style="font-weight: 600; color: #d4af37;">${d.codigo}</td>
                <td>${d.porcentaje}%</td>
                <td>${d.usos_maximos === 0 ? 'Ilimitado' : d.usos_maximos}</td>
                <td>${d.usos_actuales}</td>
                <td>${disponible}</td>
                <td>${fechaFin}</td>
                <td>
                    <span style="padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600; ${
                        puedeUsarse 
                            ? 'background: #e8f5e9; color: #2e7d32;' 
                            : 'background: #ffebee; color: #c62828;'
                    }">
                        ${puedeUsarse ? '✓ Activo' : '✕ Inactivo'}
                    </span>
                </td>
                <td>
                    <button onclick="editarDescuento('${d.id}')" style="padding: 0.5rem 1rem; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; margin-right: 0.5rem;">Editar</button>
                    <button onclick="eliminarDescuento('${d.id}', '${d.codigo}')" style="padding: 0.5rem 1rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Editar descuento
async function editarDescuento(id) {
    try {
        const { data: descuento, error } = await supabaseClient
            .from('descuentos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        // Rellenar formulario
        document.getElementById('desc-codigo').value = descuento.codigo;
        document.getElementById('desc-porcentaje').value = descuento.porcentaje;
        document.getElementById('desc-usos-max').value = descuento.usos_maximos;
        document.getElementById('desc-descripcion').value = descuento.descripcion || '';
        document.getElementById('desc-activo').checked = descuento.activo;
        
        if (descuento.fecha_fin) {
            const fecha = new Date(descuento.fecha_fin);
            const offset = fecha.getTimezoneOffset();
            const fechaLocal = new Date(fecha.getTime() - offset * 60000);
            document.getElementById('desc-fecha-fin').value = fechaLocal.toISOString().slice(0, 16);
        }
        
        document.getElementById('form-descuento').dataset.id = id;
        document.getElementById('descuento-titulo').textContent = 'Editar Código de Descuento';
        document.getElementById('formulario-descuento').style.display = 'block';
        document.getElementById('desc-codigo').focus();
        
    } catch (error) {
        console.error('Error cargando descuento:', error);
        alert('Error al cargar el descuento');
    }
}

// Eliminar descuento
function eliminarDescuento(id, codigo) {
    showConfirmation(`¿Estás seguro de que quieres eliminar el código "${codigo}"?`, async () => {
        try {
            const { error } = await supabaseClient
                .from('descuentos')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            alert('Descuento eliminado correctamente');
            cargarDescuentos();
            
        } catch (error) {
            console.error('Error eliminando descuento:', error);
            alert('Error al eliminar el descuento: ' + error.message);
        }
    });
}

// Limpiar búsqueda de descuentos
function limpiarBusquedaDescuentos() {
    document.getElementById('buscar-descuentos').value = '';
    cargarDescuentos();
}

// Buscar descuentos
document.addEventListener('DOMContentLoaded', function() {
    const buscarInput = document.getElementById('buscar-descuentos');
    if (buscarInput) {
        buscarInput.addEventListener('input', async function() {
            const busqueda = this.value.toUpperCase();
            
            if (busqueda === '') {
                cargarDescuentos();
                return;
            }
            
            try {
                const { data: descuentos, error } = await supabaseClient
                    .from('descuentos')
                    .select('*')
                    .ilike('codigo', `%${busqueda}%`)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                mostrarDescuentos(descuentos || []);
                
            } catch (error) {
                console.error('Error buscando descuentos:', error);
            }
        });
    }
});

// Cargar descuentos cuando se carga la página
window.addEventListener('load', function() {
    // Esperar a que Supabase esté listo
    let intentos = 0;
    const intervalo = setInterval(() => {
        if (window.supabaseClient) {
            clearInterval(intervalo);
            cargarDescuentos();
        }
        intentos++;
        if (intentos > 50) {
            clearInterval(intervalo);
            console.error('No se pudo inicializar Supabase');
        }
    }, 100);
});

// Función helper para mostrar confirmación
function showConfirmation(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-message').textContent = message;
    modal.style.display = 'flex';
    
    const btnOk = document.getElementById('confirm-ok');
    const btnCancel = document.getElementById('confirm-cancel');
    
    const handleOk = () => {
        onConfirm();
        cleanupListeners();
        modal.style.display = 'none';
    };
    
    const handleCancel = () => {
        cleanupListeners();
        modal.style.display = 'none';
    };
    
    const cleanupListeners = () => {
        btnOk.removeEventListener('click', handleOk);
        btnCancel.removeEventListener('click', handleCancel);
    };
    
    btnOk.addEventListener('click', handleOk);
    btnCancel.addEventListener('click', handleCancel);
}
