// ===== FUNCIONES PARA APLICAR DESCUENTOS EN EL CLIENTE =====

/**
 * Validar y aplicar código de descuento
 * @param {string} codigo - Código del descuento
 * @returns {Promise<Object>} - Objeto con descuento o error
 */
async function aplicarCodigo(codigo) {
    try {
        // Esperar a que Supabase esté inicializado
        let intentos = 0;
        while (!window.supabaseClient && intentos < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            intentos++;
        }
        
        if (!window.supabaseClient) {
            return { error: 'No se pudo conectar con el servidor' };
        }
        
        const supabaseClient = window.supabaseClient;
        
        if (!codigo || codigo.trim() === '') {
            return { error: 'Ingresa un código de descuento' };
        }
        
        const codigoNormalizado = codigo.toUpperCase().trim();
        
        // Buscar el descuento (sin filtrar por activo)
        const { data: descuentos, error } = await supabaseClient
            .from('descuentos')
            .select('*')
            .eq('codigo', codigoNormalizado);
        
        if (error) {
            console.error('Error buscando descuento:', error);
            return { error: 'Error al buscar el código' };
        }
        
        if (!descuentos || descuentos.length === 0) {
            return { error: 'Código de descuento no válido' };
        }
        
        const descuento = descuentos[0];
        
        // Validar disponibilidad
        const ahora = new Date();
        
        // Verificar si está activo
        if (!descuento.activo) {
            return { error: 'Este código de descuento no está disponible' };
        }
        
        // Verificar si ha vencido
        if (descuento.fecha_fin && new Date(descuento.fecha_fin) < ahora) {
            return { error: 'Este código de descuento ha expirado' };
        }
        
        // Verificar usos
        if (descuento.usos_maximos > 0 && descuento.usos_actuales >= descuento.usos_maximos) {
            return { error: 'Este código de descuento no tiene más usos disponibles' };
        }
        
        return {
            valido: true,
            codigo: descuento.codigo,
            porcentaje: descuento.porcentaje,
            descripcion: descuento.descripcion,
            id: descuento.id
        };
        
    } catch (error) {
        console.error('Error validando código:', error);
        return { error: 'Error al validar el código' };
    }
}

/**
 * Registrar el uso de un código de descuento
 * @param {string} descuentoId - ID del descuento
 * @returns {Promise<void>}
 */
async function registrarUsoDescuento(descuentoId) {
    try {
        // Esperar a que Supabase esté inicializado
        let intentos = 0;
        while (!window.supabaseClient && intentos < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            intentos++;
        }
        
        if (!window.supabaseClient) {
            console.warn('No se pudo registrar uso de descuento: Supabase no inicializado');
            return;
        }
        
        const supabaseClient = window.supabaseClient;
        
        // Primero, obtener el valor actual
        const { data: descuento, error: errorObtener } = await supabaseClient
            .from('descuentos')
            .select('usos_actuales')
            .eq('id', descuentoId)
            .single();
        
        if (errorObtener) {
            console.error('Error obteniendo descuento:', errorObtener);
            return;
        }
        
        // Luego, actualizar incrementando el contador
        const nuevoUso = (descuento?.usos_actuales || 0) + 1;
        
        const { error: errorActualizar } = await supabaseClient
            .from('descuentos')
            .update({ 
                usos_actuales: nuevoUso,
                updated_at: new Date().toISOString()
            })
            .eq('id', descuentoId);
        
        if (errorActualizar) {
            console.error('Error actualizando usos:', errorActualizar);
            return;
        }
        
        console.log(`✓ Uso de descuento registrado: ${nuevoUso} uso(s)`);
        
    } catch (error) {
        console.error('Error registrando uso de descuento:', error);
    }
}

/**
 * Calcular descuento en un monto
 * @param {number} monto - Monto original
 * @param {number} porcentaje - Porcentaje de descuento
 * @returns {Object} - Objeto con montos
 */
function calcularDescuento(monto, porcentaje) {
    const descuento = (monto * porcentaje) / 100;
    return {
        original: monto,
        descuento: descuento,
        final: monto - descuento
    };
}

/**
 * Obtener descuentos activos
 * @returns {Promise<Array>} - Lista de descuentos activos
 */
async function obtenerDescuentosActivos() {
    try {
        // Esperar a que Supabase esté inicializado
        let intentos = 0;
        while (!window.supabaseClient && intentos < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            intentos++;
        }
        
        if (!window.supabaseClient) {
            return [];
        }
        
        const supabaseClient = window.supabaseClient;
        const ahora = new Date();
        
        const { data: descuentos, error } = await supabaseClient
            .from('descuentos')
            .select('*')
            .eq('activo', true)
            .or(`fecha_fin.is.null,fecha_fin.gt.${ahora.toISOString()}`)
            .order('porcentaje', { ascending: false });
        
        if (error) throw error;
        
        return descuentos.filter(d => {
            // Filtrar por usos disponibles
            if (d.usos_maximos > 0) {
                return d.usos_actuales < d.usos_maximos;
            }
            return true;
        });
        
    } catch (error) {
        console.error('Error obteniendo descuentos:', error);
        return [];
    }
}

/**
 * Obtener mejor descuento disponible
 * @returns {Promise<Object|null>} - Mejor descuento o null
 */
async function obtenerMejorDescuento() {
    try {
        const descuentos = await obtenerDescuentosActivos();
        if (descuentos.length === 0) return null;
        
        return descuentos[0]; // Ya están ordenados por porcentaje descendente
        
    } catch (error) {
        console.error('Error obteniendo mejor descuento:', error);
        return null;
    }
}
