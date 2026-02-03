/**
 * Stock Real Time - Polling de stock cada 2 segundos
 * Mantiene el stock sincronizado con la BD en todo momento
 */

let productosActualesStockSync = {};
let stockPollingInterval = null;
let productIdsPendientesSync = new Set();

// Iniciar polling cuando la página carga
document.addEventListener('DOMContentLoaded', () => {
    iniciarStockPolling();
});

/**
 * Iniciar polling del stock
 */
function iniciarStockPolling() {
    console.log('[Stock Polling] Iniciando sincronización de stock en tiempo real...');
    
    // Detener el polling anterior si existe
    if (stockPollingInterval) {
        clearInterval(stockPollingInterval);
    }
    
    // Polling cada 2 segundos
    stockPollingInterval = setInterval(() => {
        if (productIdsPendientesSync.size > 0) {
            actualizarStockEnTiempoReal();
        }
    }, 2000); // 2 segundos
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
    });
    
    console.log('[Stock Polling] Productos registrados para sincronización:', productIdsPendientesSync.size);
    
    // Hacer una actualización inmediata
    actualizarStockEnTiempoReal();
}

/**
 * Obtener stock real de la BD y actualizar la UI
 */
async function actualizarStockEnTiempoReal() {
    if (productIdsPendientesSync.size === 0) return;
    
    try {
        const ids = Array.from(productIdsPendientesSync).join(',');
        
        const response = await fetch(`/api/get-real-stock?ids=${ids}`, {
            method: 'GET',
            headers: { 
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            console.warn('[Stock Polling] Error al obtener stock:', response.status);
            return;
        }
        
        const data = await response.json();
        
        if (!data.success || !data.stock) {
            console.warn('[Stock Polling] Respuesta inválida:', data);
            return;
        }
        
        // Actualizar stock en los objetos locales
        let cambiosDetectados = false;
        Object.entries(data.stock).forEach(([productId, stockInfo]) => {
            const idNum = parseInt(productId);
            const productoLocal = productosActualesStockSync[idNum];
            
            if (productoLocal && productoLocal.stock !== stockInfo.stock) {
                console.log(`[Stock Polling] ✓ Stock actualizado: ${stockInfo.nombre} (${productoLocal.stock} -> ${stockInfo.stock})`);
                productoLocal.stock = stockInfo.stock;
                cambiosDetectados = true;
            }
        });
        
        // Si hay cambios, actualizar la UI
        if (cambiosDetectados) {
            console.log('[Stock Polling] Re-renderizando productos con stock actualizado...');
            
            if (typeof renderizarProductos === 'function') {
                // En página de categorías
                const productosActuales = Object.values(productosActualesStockSync);
                renderizarProductos(productosActuales);
            } else if (typeof window.actualizarStockProductoDetalle === 'function') {
                // En página de detalle del producto
                window.actualizarStockProductoDetalle();
            }
        }
        
    } catch (error) {
        console.warn('[Stock Polling] Error:', error);
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
 * Sincronizar productos desde categorias.js
 */
if (typeof window !== 'undefined') {
    window.registrarProductosParaSync = registrarProductosParaSync;
    window.actualizarStockEnTiempoReal = actualizarStockEnTiempoReal;
    window.detenerStockPolling = detenerStockPolling;
}
