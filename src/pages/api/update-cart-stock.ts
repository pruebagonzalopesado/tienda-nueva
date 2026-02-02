import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

export const POST: APIRoute = async ({ request }) => {
    try {
        const { productId, cantidad, accion } = await request.json();

        // Validar datos
        if (!productId || !cantidad || !accion) {
            console.warn('[update-cart-stock] Datos incompletos:', { productId, cantidad, accion });
            return new Response(JSON.stringify({ success: false, error: 'Datos incompletos' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!['restar', 'sumar'].includes(accion)) {
            console.warn('[update-cart-stock] Acción no válida:', accion);
            return new Response(JSON.stringify({ success: false, error: 'Acción no válida' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Obtener stock actual
        const { data: producto, error: fetchError } = await supabase
            .from('products')
            .select('id, stock, nombre')
            .eq('id', productId)
            .single();

        if (fetchError) {
            console.error('[update-cart-stock] Error al obtener producto:', fetchError);
            return new Response(JSON.stringify({ error: 'Producto no encontrado', details: fetchError.message }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!producto) {
            console.warn('[update-cart-stock] Producto no encontrado:', productId);
            return new Response(JSON.stringify({ error: 'Producto no encontrado' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Calcular nuevo stock
        const stockActual = producto.stock || 0;
        const nuevoStock = accion === 'restar' 
            ? Math.max(0, stockActual - cantidad)
            : stockActual + cantidad;

        // Actualizar stock en BD
        const { error: updateError, data: updateData } = await supabase
            .from('products')
            .update({ stock: nuevoStock })
            .eq('id', productId)
            .select('stock');

        if (updateError) {
            console.error('[update-cart-stock] Error actualizando stock:', updateError);
            return new Response(JSON.stringify({ 
                error: 'Error al actualizar stock',
                details: updateError.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`[update-cart-stock] ✅ Stock actualizado para producto ${productId} (${producto.nombre}): ${stockActual} -> ${nuevoStock} (${accion})`);

        return new Response(JSON.stringify({
            success: true,
            stockAnterior: stockActual,
            stockNuevo: nuevoStock,
            producto: producto.nombre
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[update-cart-stock] Error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

