// Sistema de reservas temporales de stock sin BD
// Usa localStorage para guardar reservas por 10 segundos (para pruebas)

console.log('[stock-reservations.js] Script cargado correctamente');

const CART_STORAGE_KEY = 'tienda_carrito_reservas';
const RESERVATION_EXPIRY_MINUTES = 15;
const RESERVATION_CHECK_INTERVAL = 60000; // Verificar cada minuto

/**
 * Obtener todas las reservas actuales
 */
function getReservations() {
  try {
    const data = localStorage.getItem(CART_STORAGE_KEY);
    if (!data) return {};
    
    const reservations = JSON.parse(data);
    const now = Date.now();
    
    // Limpiar reservas expiradas
    const activeReservations = {};
    for (const [key, reservation] of Object.entries(reservations)) {
      if (reservation.expiresAt > now) {
        activeReservations[key] = reservation;
      } else {
        // La reserva expiró, restaurar stock en BD
        if (window.supabaseClient && reservation.cantidad > 0) {
          console.log(`[getReservations] Reserva expirada para ${reservation.productName}, restaurando stock...`);
          restoreStockInDatabase(reservation.productId, reservation.cantidad).then(() => {
            console.log(`[getReservations] Stock restaurado para ${reservation.productName}`);
          });
        }
      }
    }
    
    // Guardar las activas
    if (Object.keys(activeReservations).length < Object.keys(reservations).length) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(activeReservations));
    }
    
    return activeReservations;
  } catch (e) {
    console.error('Error obteniendo reservas:', e);
    return {};
  }
}

/**
 * Reservar stock para un producto
 * @param {number} productId - ID del producto
 * @param {number} cantidad - Cantidad a reservar
 * @param {string} productName - Nombre del producto
 */
function reserveStock(productId, cantidad, productName = '') {
  try {
    const reservations = getReservations();
    const key = `product_${productId}`;
    const now = Date.now();
    const expiresAt = now + (RESERVATION_EXPIRY_MINUTES * 60 * 1000);
    
    // Si ya existe, sumar cantidad
    if (reservations[key]) {
      reservations[key].cantidad += cantidad;
      reservations[key].expiresAt = expiresAt; // Renovar expiración
    } else {
      reservations[key] = {
        productId,
        cantidad,
        productName,
        reservedAt: now,
        expiresAt
      };
    }
    
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(reservations));
    console.log(`[reserveStock] Reservado ${cantidad} de ${productName} (ID: ${productId})`);
    return true;
  } catch (e) {
    console.error('Error reservando stock:', e);
    return false;
  }
}

/**
 * Liberar una reserva (cuando se compra o se vacía carrito)
 * @param {number} productId - ID del producto
 */
function releaseReservation(productId) {
  try {
    const reservations = getReservations();
    const key = `product_${productId}`;
    
    if (reservations[key]) {
      delete reservations[key];
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(reservations));
      console.log(`[releaseReservation] Liberada reserva del producto ${productId}`);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error liberando reserva:', e);
    return false;
  }
}

/**
 * Obtener cantidad reservada de un producto
 * @param {number} productId - ID del producto
 */
function getReservedQuantity(productId) {
  const reservations = getReservations();
  const key = `product_${productId}`;
  return reservations[key]?.cantidad || 0;
}

/**
 * Obtener stock disponible real
 * @param {number} productId - ID del producto
 * @param {number} currentStock - Stock actual en BD
 */
function getAvailableStock(productId, currentStock) {
  const reserved = getReservedQuantity(productId);
  return Math.max(0, currentStock - reserved);
}

/**
 * Limpiar todas las reservas (cuando se vacía el carrito)
 */
function clearAllReservations() {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
    console.log('[clearAllReservations] Todas las reservas eliminadas');
    return true;
  } catch (e) {
    console.error('Error limpiando reservas:', e);
    return false;
  }
}

/**
 * Actualizar stock visual en la página
 * Debe llamarse cuando se añade un producto al carrito
 * @param {number} productId - ID del producto
 * @param {number} newStock - Nuevo stock disponible
 */
function updateStockDisplay(productId, newStock) {
  const stockElement = document.getElementById(`stock-${productId}`);
  if (stockElement) {
    stockElement.textContent = newStock;
    // Cambiar color si no hay stock
    if (newStock <= 0) {
      stockElement.classList.add('sin-stock');
      stockElement.textContent = 'Sin stock';
    } else {
      stockElement.classList.remove('sin-stock');
    }
  }
}

/**
 * Cuando se añade al carrito
 * Llama a esto desde el código de carrito
 */
function onAddToCart(productId, cantidad, productName, currentStock) {
  console.log(`[onAddToCart] Iniciando reserva de stock:`, { productId, cantidad, productName, currentStock });
  
  // Reservar el stock en localStorage
  reserveStock(productId, cantidad, productName);
  
  // Actualizar stock en la base de datos (restar cantidad)
  if (window.supabaseClient) {
    console.log(`[onAddToCart] Supabase disponible, actualizando BD...`);
    updateStockInDatabase(productId, cantidad);
  } else {
    console.warn('[onAddToCart] Supabase NO disponible, solo reserva local');
  }
  
  console.log(`[onAddToCart] Stock de ${productName} restado por 10 segundos`);
}

/**
 * Actualizar stock en la base de datos (restar cantidad)
 */
async function updateStockInDatabase(productId, cantidad) {
  try {
    // Primero obtener el stock actual
    const { data: product, error: fetchError } = await window.supabaseClient
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();
    
    if (fetchError || !product) {
      console.error('[updateStockInDatabase] Error obteniendo producto:', fetchError);
      return false;
    }
    
    const newStock = Math.max(0, product.stock - cantidad);
    
    // Actualizar con el nuevo valor
    const { error } = await window.supabaseClient
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId);
    
    if (error) {
      console.error('[updateStockInDatabase] Error:', error);
      return false;
    }
    
    console.log(`[updateStockInDatabase] Stock del producto ${productId} reducido de ${product.stock} a ${newStock}`);
    return true;
  } catch (e) {
    console.error('[updateStockInDatabase] Exception:', e);
    return false;
  }
}

/**
 * Restaurar stock en la base de datos (cuando expira la reserva)
 */
async function restoreStockInDatabase(productId, cantidad) {
  try {
    // Primero obtener el stock actual
    const { data: product, error: fetchError } = await window.supabaseClient
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();
    
    if (fetchError || !product) {
      console.error('[restoreStockInDatabase] Error obteniendo producto:', fetchError);
      return false;
    }
    
    const newStock = product.stock + cantidad;
    
    // Actualizar con el nuevo valor
    const { error } = await window.supabaseClient
      .from('products')
      .update({ stock: newStock })
      .eq('id', productId);
    
    if (error) {
      console.error('[restoreStockInDatabase] Error:', error);
      return false;
    }
    
    console.log(`[restoreStockInDatabase] Stock del producto ${productId} restaurado de ${product.stock} a ${newStock}`);
    return true;
  } catch (e) {
    console.error('[restoreStockInDatabase] Exception:', e);
    return false;
  }
}

/**
 * Cuando se vacía el carrito
 * Libera todas las reservas y restaura stock en BD
 */
function onClearCart() {
  const reservations = getReservations();
  
  // Restaurar stock de cada reserva en BD
  Object.values(reservations).forEach(reservation => {
    if (window.supabaseClient && reservation.cantidad > 0) {
      restoreStockInDatabase(reservation.productId, reservation.cantidad);
    }
  });
  
  clearAllReservations();
  
  // Recargar stock de todos los productos
  const products = document.querySelectorAll('[data-product-id]');
  products.forEach(el => {
    const productId = el.getAttribute('data-product-id');
    const originalStock = el.getAttribute('data-original-stock');
    if (originalStock) {
      updateStockDisplay(productId, parseInt(originalStock));
    }
  });
}

/**
 * Cuando se completa una compra
 * Libera las reservas de los productos comprados
 */
function onPurchaseComplete(productIds) {
  productIds.forEach(id => {
    releaseReservation(id);
  });
  clearAllReservations();
}

// Limpiar reservas expiradas periódicamente
setInterval(() => {
  const reservations = getReservations(); // Esto limpia automáticamente
  console.log('[cleanupTask] Reservas activas:', Object.keys(reservations).length);
}, RESERVATION_CHECK_INTERVAL);

// Actualizar stock visual periódicamente desde la BD
let lastStockValues = {};
const updateStockInterval = setInterval(async () => {
  if (!window.supabaseClient) return;
  
  try {
    const stockStatus = document.getElementById('product-stock-status');
    if (!stockStatus) return;
    
    // Obtener ID del producto de la URL o data attribute
    const urlParts = window.location.pathname.split('/');
    const productId = parseInt(urlParts[urlParts.length - 1]);
    
    if (isNaN(productId)) return;
    
    // Obtener stock actual de BD
    const { data: product, error } = await window.supabaseClient
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();
    
    if (error || !product) return;
    
    // Si el stock cambió, actualizar más frecuentemente
    if (lastStockValues[productId] !== product.stock) {
      lastStockValues[productId] = product.stock;
      clearInterval(updateStockInterval);
      // Cambiar a actualizar cada 2 segundos durante 20 segundos
      const fastUpdateInterval = setInterval(() => updateStockDisplay(productId, product.stock), 2000);
      setTimeout(() => {
        clearInterval(fastUpdateInterval);
        // Volver a cada 5 segundos
        setInterval(() => updateStockDisplay(productId, product.stock), 5000);
      }, 20000);
      return;
    }
    
    // Calcular stock disponible (descontando reservas)
    const availableStock = getAvailableStock(productId, product.stock);
    
    // Actualizar el texto si cambió
    const currentText = stockStatus.textContent;
    let newText = '';
    
    if (availableStock > 5) {
      newText = `${availableStock} unidades disponibles${availableStock < product.stock ? ` (${product.stock - availableStock} reservadas)` : ''}`;
      stockStatus.className = 'stock-status in-stock';
    } else if (availableStock > 0) {
      newText = `Solo ${availableStock} unidades disponibles${availableStock < product.stock ? ` (${product.stock - availableStock} reservadas)` : ''}`;
      stockStatus.className = 'stock-status low-stock';
    } else {
      newText = 'Agotado';
      stockStatus.className = 'stock-status out-stock';
    }
    
    if (currentText !== newText) {
      stockStatus.textContent = newText;
      console.log(`[stockRefresh] Stock actualizado: ${newText}`);
    }
  } catch (e) {
    console.error('[stockRefresh] Error:', e);
  }
}, 5000); // Cada 5 segundos

// Verificar reservas expiradas cada 30 segundos y restaurar stock
setInterval(() => {
  try {
    const reservations = getReservations(); // Esto limpia automáticamente las expiradas
    const count = Object.keys(reservations).length;
    if (count > 0) {
      console.log(`[expiryCheck] ${count} reserva(s) activa(s)`);
    }
  } catch (e) {
    console.error('[expiryCheck] Error:', e);
  }
}, 30000); // Cada 30 segundos

/**
 * Mostrar notificación de reserva de stock (función global)
 */
function showStockReservationMessage(productName, quantity) {
  try {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = 'stock-reservation-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-header">
                <span class="notification-title">Stock Reservado</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
            </div>
            <p class="notification-message">
                ${quantity} unidad(es) de <strong>${productName}</strong> reservada(s) por 10 segundos
            </p>
            <div class="reservation-timer">
                <div class="timer-bar" style="width: 100%;"></div>
                <p class="timer-text">Tiempo restante: 15:00</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animar el temporizador
    const timerBar = notification.querySelector('.timer-bar');
    const timerText = notification.querySelector('.timer-text');
    let secondsLeft = 15 * 60;
    
    const timerInterval = setInterval(() => {
        secondsLeft--;
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        
        timerText.textContent = `Tiempo restante: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        timerBar.style.width = ((secondsLeft / (15 * 60)) * 100) + '%';
        
        if (secondsLeft <= 0) {
            clearInterval(timerInterval);
            notification.classList.add('expired');
            timerText.textContent = 'Reserva expirada - stock restaurado';
            setTimeout(() => notification.remove(), 2000);
        }
    }, 1000);
    
    // Desaparecer después de 3 segundos (contador permanecerá en el carrito)
    setTimeout(() => {
        notification.classList.add('fade-out');
    }, 3000);
    
    console.log(`[showStockReservationMessage] Notificación mostrada para ${productName}`);
  } catch (e) {
    console.error('[showStockReservationMessage] Error:', e);
  }
}

// Limpiar al cerrar sesión
window.addEventListener('beforeunload', () => {
  // Opcional: limpiar todo al cerrar
  // clearAllReservations();
});

// Exportar para uso en otros scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    reserveStock,
    releaseReservation,
    getReservedQuantity,
    getAvailableStock,
    clearAllReservations,
    updateStockDisplay,
    onAddToCart,
    onClearCart,
    onPurchaseComplete,
    getReservations
  };
}
