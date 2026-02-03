import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

/**
 * Endpoint para agregar a carrito con validación de stock en tiempo real
 * Usa transacciones para evitar race conditions
 */
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

        // Obtener stock actual del producto
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

        // Validar que hay stock disponible
        if (stockActual < cantidad) {
            console.warn(`[add-to-cart-validated] Stock insuficiente para ${productId}: solicitado ${cantidad}, disponible ${stockActual}`);
            return new Response(JSON.stringify({
                success: false,
                error: `Stock insuficiente. Solo hay ${stockActual} unidad(es) disponible(s)`,
                stockDisponible: stockActual,
                producto: producto.nombre
            }), {
                status: 409, // Conflict
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Restar el stock de forma atómica
        const nuevoStock = stockActual - cantidad;
        
        const { error: updateError, data: updateData } = await supabase
            .from('products')
            .update({ stock: nuevoStock })
            .eq('id', productId)
            .eq('stock', stockActual) // Lock optimista: solo actualizar si el stock no cambió
            .select('stock');

        // Si la actualización no afectó ninguna fila, significa que el stock cambió
        if (!updateData || updateData.length === 0) {
            // Reintentar obteniendo el stock actual
            const { data: productoActualizado } = await supabase
                .from('products')
                .select('stock')
                .eq('id', productId)
                .single();

            const stockActualizado = productoActualizado?.stock || 0;
            
            if (stockActualizado < cantidad) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `Stock insuficiente. Solo hay ${stockActualizado} unidad(es) disponible(s)`,
                    stockDisponible: stockActualizado,
                    producto: producto.nombre
                }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
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
            headers: { 'Content-Type': 'application/json' }
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
