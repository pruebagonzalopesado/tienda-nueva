import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

/**
 * Endpoint para agregar a carrito con validación de stock en TIEMPO REAL
 * Lee el stock directamente de la BD cada vez
 * Realiza la actualización de forma atómica
 */
export const POST: APIRoute = async ({ request }) => {
    try {
        // Validar credenciales DENTRO del endpoint
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('❌ VARIABLES NO CONFIGURADAS EN SERVIDOR');
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Variables de entorno no configuradas en servidor',
                stockDisponible: 0
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

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

        // 🔄 LEER STOCK ACTUAL DE LA BD EN TIEMPO REAL (MÁXIMA SEGURIDAD)
        const { data: producto, error: fetchError } = await supabase
            .from('products')
            .select('id, stock, nombre, precio')
            .eq('id', productId)
            .single();

        if (fetchError || !producto) {
            console.error('[add-to-cart-validated] Producto no encontrado:', productId);
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

        // ⚠️ VALIDACIÓN CRÍTICA: Stock real en este EXACTO momento
        if (stockActual < cantidad) {
            console.warn(`[add-to-cart-validated] Stock insuficiente para ${productId}: solicitado ${cantidad}, disponible ${stockActual}`);
            return new Response(JSON.stringify({
                success: false,
                error: `Stock insuficiente. Solo hay ${stockActual} unidad(es) disponible(s)`,
                stockDisponible: stockActual,
                producto: producto.nombre
            }), {
                status: 409, // Conflict
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
            });
        }

        // 🔒 ACTUALIZACIÓN ATÓMICA: Restar stock SOLO SI el valor actual sigue siendo el mismo
        // Esto evita que dos usuarios resten stock simultáneamente
        const nuevoStock = stockActual - cantidad;
        
        const { error: updateError, data: updateData, count } = await supabase
            .from('products')
            .update({ stock: nuevoStock })
            .eq('id', productId)
            .eq('stock', stockActual) // ← CRUCIAL: Solo actualiza si stock sigue siendo stockActual
            .select('stock');

        // Si no se actualizó ninguna fila, otro proceso ya cambió el stock
        if (!updateData || updateData.length === 0) {
            console.warn(`[add-to-cart-validated] Stock cambió entre validación y actualización para ${productId}`);
            
            // Obtener el stock actual AHORA
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

            // Si aún hay stock, reintentar la actualización
            const { data: updateData2 } = await supabase
                .from('products')
                .update({ stock: stockAhora - cantidad })
                .eq('id', productId)
                .eq('stock', stockAhora)
                .select('stock');

            if (!updateData2 || updateData2.length === 0) {
                // Falló nuevamente, otro usuario debe estar agregando
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

            console.log(`[add-to-cart-validated] ✅ Producto agregado al carrito (reintento): ${producto.nombre} (cantidad: ${cantidad}, stock: ${stockAhora} -> ${stockAhora - cantidad})`);

            return new Response(JSON.stringify({
                success: true,
                mensaje: `${producto.nombre} agregado al carrito`,
                stockAnterior: stockAhora,
                stockNuevo: stockAhora - cantidad,
                producto: {
                    id: producto.id,
                    nombre: producto.nombre,
                    precio: producto.precio,
                    stockDisponible: stockAhora - cantidad
                }
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
            });
        }

        console.log(`[add-to-cart-validated] ✅ Producto agregado al carrito: ${producto.nombre} (cantidad: ${cantidad}, stock: ${stockActual} -> ${nuevoStock})`);

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
