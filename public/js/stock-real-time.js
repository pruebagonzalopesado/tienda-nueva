/**
 * Stock Real Time - Polling AGRESIVO de stock cada 1 segundo
 * Mantiene el stock sincronizado con la BD en TODO momento sin necesidad de recargar
 */

let productosActualesStockSync = {};
let stockPollingInterval = null;
let productIdsPendientesSync = new Set();
let ultimaActualizacion = {};

// Iniciar polling INMEDIATAMENTE
(function() {
    console.log('[Stock Polling] Sistema inicializado y listo para sincronizar');
    
    // Comenzar polling apenas se carga el script
    setTimeout(() => {
        iniciarStockPolling();
    }, 100);
})();

/**
 * Iniciar polling del stock - AGRESIVO cada 1 segundo
 */
function iniciarStockPolling() {
    console.log('[Stock Polling] ⚡ Iniciando sincronización AGRESIVA de stock en tiempo real...');
    
    // Detener el polling anterior si existe
    if (stockPollingInterval) {
        clearInterval(stockPollingInterval);
    }
    
    // Polling AGRESIVO cada 1 segundo
    stockPollingInterval = setInterval(() => {
        if (productIdsPendientesSync.size > 0) {
            actualizarStockEnTiempoReal();
        }
    }, 1000); // 1 segundo - MUCHO MÁS RÁPIDO
}

/**
 * Registrar IDs de productos para polling
 * Se llama cuando carga la página de productos
 */
function registrarProductosParaSync(productos) {
    if (!Array.isArray(productos)) return;
    
    productos.forEach(p => {
        productosActualesStockSync[p.id] = p;
        productIdsPendientesSync.add(p.id);
        ultimaActualizacion[p.id] = p.stock;
    });
    
    console.log('[Stock Polling] ✓ Productos registrados:', productIdsPendientesSync.size);
    console.log('[Stock Polling] IDs:', Array.from(productIdsPendientesSync).join(', '));
    
    // Hacer una actualización INMEDIATA
    actualizarStockEnTiempoReal();
}

/**
 * Obtener stock real de la BD y actualizar la UI - SINCRONIZACIÓN AGRESIVA
 */
async function actualizarStockEnTiempoReal() {
    if (productIdsPendientesSync.size === 0) return;
    
    try {
        const ids = Array.from(productIdsPendientesSync).join(',');
        
        const response = await fetch(`/api/get-real-stock?ids=${ids}`, {
            method: 'GET',
            headers: { 
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            console.warn('[Stock Polling] ⚠️ Error al obtener stock:', response.status);
            return;
        }
        
        const data = await response.json();
        
        if (!data.success || !data.stock) {
            console.warn('[Stock Polling] ⚠️ Respuesta inválida');
            return;
        }
        
        // Detectar cambios y actualizar
        let cambiosDetectados = false;
        let cambiosLista = [];
        
        Object.entries(data.stock).forEach(([productId, stockInfo]) => {
            const idNum = parseInt(productId);
            const productoLocal = productosActualesStockSync[idNum];
            const ultimoStock = ultimaActualizacion[idNum];
            
            if (productoLocal && ultimoStock !== stockInfo.stock) {
                console.log(`[Stock Polling] 🔄 CAMBIO DETECTADO: ${stockInfo.nombre} (${ultimoStock} → ${stockInfo.stock})`);
                productoLocal.stock = stockInfo.stock;
                ultimaActualizacion[idNum] = stockInfo.stock;
                cambiosDetectados = true;
                cambiosLista.push({
                    id: idNum,
                    nombre: stockInfo.nombre,
                    stockAnterior: ultimoStock,
                    stockNuevo: stockInfo.stock
                });
            }
        });
        
        // Si hay cambios, actualizar la UI inmediatamente
        if (cambiosDetectados) {
            console.log('[Stock Polling] 🚀 Re-renderizando UI con stock actualizado...');
            console.log('[Stock Polling] Cambios:', cambiosLista);
            
            // Actualizar en categorías
            if (typeof renderizarProductos === 'function' && typeof productosActuales !== 'undefined') {
                // Sincronizar los datos globales con los actualizados
                productosActuales.forEach(p => {
                    const actualizado = productosActualesStockSync[p.id];
                    if (actualizado) {
                        p.stock = actualizado.stock;
                    }
                });
                renderizarProductos(productosActuales);
            }
            
            // Actualizar en detalle del producto
            if (typeof currentProduct !== 'undefined' && currentProduct) {
                const actualizado = productosActualesStockSync[currentProduct.id];
                if (actualizado) {
                    currentProduct.stock = actualizado.stock;
                    if (typeof window.actualizarStockProductoDetalle === 'function') {
                        window.actualizarStockProductoDetalle();
                    }
                }
            }
        }
        
    } catch (error) {
        console.warn('[Stock Polling] ⚠️ Error en actualización:', error.message);
    }
}

/**
 * Detener polling
 */
function detenerStockPolling() {
    if (stockPollingInterval) {
        clearInterval(stockPollingInterval);
        stockPollingInterval = null;
        console.log('[Stock Polling] Sincronización detenida');
    }
}

/**
 * Forzar actualización inmediata
 */
function forzarActualizacionStock() {
    console.log('[Stock Polling] 🔁 Forzando actualización inmediata...');
    actualizarStockEnTiempoReal();
}

/**
 * Exponer funciones globales
 */
if (typeof window !== 'undefined') {
    window.registrarProductosParaSync = registrarProductosParaSync;
    window.actualizarStockEnTiempoReal = actualizarStockEnTiempoReal;
    window.detenerStockPolling = detenerStockPolling;
    window.forzarActualizacionStock = forzarActualizacionStock;
}
