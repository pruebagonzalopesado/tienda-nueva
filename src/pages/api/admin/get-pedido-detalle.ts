import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async ({ request }) => {
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener ID del pedido de los parámetros
    const url = new URL(request.url);
    const pedidoId = url.searchParams.get('id');

    if (!pedidoId) {
      return new Response(
        JSON.stringify({ error: 'ID de pedido requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener detalles del pedido
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();

    if (error) {
      console.error('Error al obtener pedido:', error);
      return new Response(
        JSON.stringify({ error: 'Pedido no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Los productos ya vienen como array en el campo 'items'
    let productos = pedido.items || [];

    // Obtener referencias de los productos desde la BD
    if (productos.length > 0) {
      // Usar 'id' o 'product_id' si no existe 'id'
      const productIds = productos.map((p: any) => p.id || p.product_id).filter(Boolean);
      
      console.log('Product IDs encontrados:', productIds);
      
      if (productIds.length > 0) {
        const { data: productosDb } = await supabase
          .from('products')
          .select('id, referencia')
          .in('id', productIds);

        if (productosDb) {
          console.log('Productos encontrados en BD:', productosDb);
          
          // Mapear referencias a los productos
          const referenciaMap = new Map(
            productosDb.map((p: any) => [String(p.id), p.referencia])
          );
          
          productos = productos.map((p: any) => {
            const id = String(p.id || p.product_id);
            const ref = referenciaMap.get(id);
            console.log(`Buscando referencia para ID ${id}: ${ref}`);
            return {
              ...p,
              referencia: ref || 'N/A'
            };
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        ...pedido,
        productos: productos,  // Renombrar 'items' a 'productos'
        nombre_cliente: pedido.nombre,
        stripe_session_id: pedido.stripe_payment_id
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en get-pedido-detalle:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
