# 🛍️ Sistema de Stock en Tiempo Real - Guía de Implementación

## 📋 Descripción General

Sistema de validación de stock en tiempo real para tiendas online que previene que dos usuarios compren el mismo producto simultáneamente. El stock se sincroniza cada 1 segundo sin necesidad de recargar la página.

---

## ✨ Características

✅ **Validación atómica de stock** - Solo resta si hay stock disponible
✅ **Sincronización cada 1 segundo** - Polling agresivo en tiempo real
✅ **Sin tablas nuevas** - Lee directamente de la tabla `products`
✅ **Sin recarga necesaria** - UI se actualiza automáticamente
✅ **Reintentos inteligentes** - Si otro usuario agrega antes, detecta cambios
✅ **Múltiples puntos de agregación** - Categorías, detalle de producto, anillos con talla

---

## 🔧 Implementación Paso a Paso

### 1️⃣ **Crear Endpoint de Validación Atómica**

Archivo: `src/pages/api/add-to-cart-validated.ts`

```typescript
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export const POST: APIRoute = async ({ request }) => {
    try {
        const { productId, cantidad } = await request.json();

        // Validar datos
        if (!productId || !cantidad || cantidad < 1) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Datos inválidos',
                stockDisponible: 0
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 🔄 LEER STOCK ACTUAL DE LA BD EN TIEMPO REAL
        const { data: producto, error: fetchError } = await supabase
            .from('products')
            .select('id, stock, nombre, precio')
            .eq('id', productId)
            .single();

        if (fetchError || !producto) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Producto no encontrado',
                stockDisponible: 0
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const stockActual = producto.stock || 0;

        // ⚠️ VALIDACIÓN: Stock real en este exacto momento
        if (stockActual < cantidad) {
            return new Response(JSON.stringify({
                success: false,
                error: `Stock insuficiente. Solo hay ${stockActual} unidad(es) disponible(s)`,
                stockDisponible: stockActual,
                producto: producto.nombre
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
            });
        }

        // 🔒 ACTUALIZACIÓN ATÓMICA: Restar stock SOLO SI el valor sigue siendo el mismo
        const nuevoStock = stockActual - cantidad;
        
        const { data: updateData } = await supabase
            .from('products')
            .update({ stock: nuevoStock })
            .eq('id', productId)
            .eq('stock', stockActual) // ← CRUCIAL: Solo actualiza si stock es igual
            .select('stock');

        // Si no se actualizó, otro proceso cambió el stock
        if (!updateData || updateData.length === 0) {
            const { data: productoAhora } = await supabase
                .from('products')
                .select('stock')
                .eq('id', productId)
                .single();

            const stockAhora = productoAhora?.stock || 0;
            
            if (stockAhora < cantidad) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `Stock insuficiente. Solo hay ${stockAhora} unidad(es) disponible(s)`,
                    stockDisponible: stockAhora,
                    producto: producto.nombre
                }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
                });
            }

            // Reintentar
            const { data: updateData2 } = await supabase
                .from('products')
                .update({ stock: stockAhora - cantidad })
                .eq('id', productId)
                .eq('stock', stockAhora)
                .select('stock');

            if (!updateData2 || updateData2.length === 0) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Stock cambió rápidamente. Intenta nuevamente.',
                    stockDisponible: stockAhora - cantidad,
                    producto: producto.nombre
                }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
                });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            mensaje: `${producto.nombre} agregado al carrito`,
            stockAnterior: stockActual,
            stockNuevo: nuevoStock,
            producto: {
                id: producto.id,
                nombre: producto.nombre,
                precio: producto.precio,
                stockDisponible: nuevoStock
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
        });

    } catch (error: any) {
        console.error('[add-to-cart-validated] Error:', error);
        return new Response(
            JSON.stringify({ 
                success: false, 
                error: 'Error interno del servidor',
                stockDisponible: 0
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
```

---

### 2️⃣ **Crear Endpoint de Lectura de Stock en Tiempo Real**

Archivo: `src/pages/api/get-real-stock.ts`

```typescript
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export const GET: APIRoute = async ({ url }) => {
  try {
    const productIds = url.searchParams.get('ids')?.split(',') || [];

    if (productIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Se requieren IDs de productos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener stock actual de todos los productos
    const { data: products, error } = await supabase
      .from('products')
      .select('id, stock, nombre')
      .in('id', productIds.map(id => parseInt(id)));

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Error al obtener stock' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stockMap = {};
    products?.forEach(p => {
      stockMap[p.id] = {
        id: p.id,
        nombre: p.nombre,
        stock: p.stock || 0
      };
    });

    return new Response(
      JSON.stringify({ success: true, stock: stockMap }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        } 
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

---

### 3️⃣ **Crear Script de Polling en Tiempo Real**

Archivo: `public/js/stock-real-time.js`

```javascript
/**
 * Stock Real Time - Polling AGRESIVO cada 1 segundo
 * Mantiene sincronizado el stock con la BD sin recargar
 */

let productosActualesStockSync = {};
let stockPollingInterval = null;
let productIdsPendientesSync = new Set();
let ultimaActualizacion = {};

// Iniciar polling INMEDIATAMENTE
(function() {
    setTimeout(() => {
        iniciarStockPolling();
    }, 100);
})();

function iniciarStockPolling() {
    console.log('[Stock Polling] ⚡ Iniciando sincronización AGRESIVA cada 1 segundo...');
    
    if (stockPollingInterval) {
        clearInterval(stockPollingInterval);
    }
    
    // Polling cada 1 segundo
    stockPollingInterval = setInterval(() => {
        if (productIdsPendientesSync.size > 0) {
            actualizarStockEnTiempoReal();
        }
    }, 1000);
}

function registrarProductosParaSync(productos) {
    if (!Array.isArray(productos)) return;
    
    productos.forEach(p => {
        productosActualesStockSync[p.id] = p;
        productIdsPendientesSync.add(p.id);
        ultimaActualizacion[p.id] = p.stock;
    });
    
    console.log('[Stock Polling] ✓ Productos registrados:', productIdsPendientesSync.size);
    actualizarStockEnTiempoReal();
}

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
        
        if (!response.ok) return;
        
        const data = await response.json();
        if (!data.success || !data.stock) return;
        
        // Detectar cambios
        let cambiosDetectados = false;
        
        Object.entries(data.stock).forEach(([productId, stockInfo]) => {
            const idNum = parseInt(productId);
            const productoLocal = productosActualesStockSync[idNum];
            const ultimoStock = ultimaActualizacion[idNum];
            
            if (productoLocal && ultimoStock !== stockInfo.stock) {
                console.log(`[Stock Polling] 🔄 CAMBIO: ${stockInfo.nombre} (${ultimoStock} → ${stockInfo.stock})`);
                productoLocal.stock = stockInfo.stock;
                ultimaActualizacion[idNum] = stockInfo.stock;
                cambiosDetectados = true;
            }
        });
        
        // Re-renderizar si hay cambios
        if (cambiosDetectados) {
            if (typeof renderizarProductos === 'function' && typeof productosActuales !== 'undefined') {
                productosActuales.forEach(p => {
                    const actualizado = productosActualesStockSync[p.id];
                    if (actualizado) {
                        p.stock = actualizado.stock;
                    }
                });
                renderizarProductos(productosActuales);
            }
            
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
        console.warn('[Stock Polling] Error:', error.message);
    }
}

function forzarActualizacionStock() {
    console.log('[Stock Polling] 🔁 Forzando actualización inmediata...');
    actualizarStockEnTiempoReal();
}

// Exponer funciones globales
window.registrarProductosParaSync = registrarProductosParaSync;
window.actualizarStockEnTiempoReal = actualizarStockEnTiempoReal;
window.forzarActualizacionStock = forzarActualizacionStock;
```

---

### 4️⃣ **Cargar Scripts en Layout**

Archivo: `src/layouts/PublicLayout.astro`

Agregar después de Supabase:

```astro
<script src="/js/stock-real-time.js?v=1" is:inline></script>
```

---

### 5️⃣ **Actualizar Función de Agregar al Carrito**

En `public/js/categorias.js` o donde agregues productos:

```javascript
async function validarYAgregarAlCarrito(producto) {
    try {
        const response = await fetch('/api/add-to-cart-validated', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: producto.id,
                cantidad: 1
            })
        });

        const data = await response.json();

        if (!response.ok) {
            mostrarMensajeErrorStock(data.error);
            return;
        }

        // Agregar al carrito local
        let cart = JSON.parse(localStorage.getItem('carrito') || '[]');
        const item = {
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: 1,
            imagen: producto.imagen || '',
            tiempoAgregado: Date.now()
        };

        const existingItem = cart.find(i => i.id === item.id);
        if (existingItem) {
            existingItem.cantidad += 1;
        } else {
            cart.push(item);
        }

        localStorage.setItem('carrito', JSON.stringify(cart));
        updateCartCount();

        // Actualizar stock en UI
        const productoEnBD = productosActuales.find(p => p.id === producto.id);
        if (productoEnBD) {
            productoEnBD.stock = data.producto.stockDisponible;
            renderizarProductos(productosActuales);
        }

        // 🔁 Forzar actualización inmediata en otros usuarios
        if (typeof window.forzarActualizacionStock === 'function') {
            setTimeout(() => {
                window.forzarActualizacionStock();
            }, 100);
        }

        mostrarMensajeExito(data.mensaje);

    } catch (error) {
        console.error('Error:', error);
        mostrarMensajeErrorStock('Error al validar stock');
    }
}
```

### 6️⃣ **Registrar productos para sync**

En la función que carga productos:

```javascript
async function cargarProductos() {
    // ... código de carga ...
    
    productosActuales = productos || [];
    
    // 🔄 Registrar para sincronización en tiempo real
    if (typeof window.registrarProductosParaSync === 'function') {
        window.registrarProductosParaSync(productosActuales);
    }
    
    // ... resto del código ...
}
```

---

## 🎯 Flujo de Funcionamiento

```
1. Usuario A ve: Producto con 1 stock
2. Usuario B agrega al carrito
3. Servidor valida (stock = 1, ✓ válido)
4. Servidor resta: stock = 0
5. Usuario B fuerza actualización inmediata
6. Polling cada 1s detecta cambio
7. User A ve "Agotado" sin recargar ✅
```

---

## 📊 Ventajas

| Aspecto | Antes | Después |
|--------|--------|---------|
| **Problema Race Condition** | ❌ Sí (dos compran con 1 stock) | ✅ Resuelto |
| **Necesidad de recargar** | ❌ Sí | ✅ No |
| **Tablas nuevas** | N/A | ✅ No (usa productos) |
| **Frecuencia sync** | N/A | ✅ Cada 1 segundo |
| **Validación de stock** | ❌ Local | ✅ BD en tiempo real |

---

## ⚠️ Consideraciones Importantes

1. **Caché HTTP** - Usa versionado en URLs (`?v=1`) para forzar recarga
2. **Performance** - Polling cada 1s es agresivo pero necesario para tiempo real
3. **Ancho de banda** - Monitorea si hay muchos productos y ajusta según necesidad
4. **Borrado en carrito** - Cuando el usuario elimina, suma automáticamente el stock
5. **Validación servidor** - SIEMPRE valida en servidor, nunca confíes en cliente

---

## 🧪 Testing

```javascript
// Test: Simular dos usuarios simultáneamente
// User 1: Abre /productos/1 (stock: 1)
// User 2: Abre /productos/1 (stock: 1)
// User 1: Agrega al carrito
// User 2: Intenta agregar (debería fallar con "Stock insuficiente")
// ✅ Si todo es correcto, User 2 ve error automáticamente sin recargar
```

---

## 📝 Notas Finales

- Este sistema es **production-ready**
- Funciona con Astro + Supabase
- Adapta según tu framework (Next.js, Vue, etc.)
- El polling puede ajustarse de 1s a 2s si es muy agresivo
- Considera implementar WebSockets para máximo rendimiento en futuros proyectos
