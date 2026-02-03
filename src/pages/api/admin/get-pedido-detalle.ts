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

    console.log('[get-pedido-detalle] Pedido obtenido - Keys:', Object.keys(pedido || {}));
    console.log('[get-pedido-detalle] Pedido.items:', pedido.items);
    console.log('[get-pedido-detalle] Pedido.productos_json:', pedido.productos_json);

    // Los productos vienen como JSON en el campo 'items' o 'productos_json'
    let productos = [];
    
    if (pedido.items) {
      try {
        const productosData = typeof pedido.items === 'string' 
          ? JSON.parse(pedido.items) 
          : pedido.items;
        productos = Array.isArray(productosData) ? productosData : [];
      } catch (e) {
        console.error('Error parseando items:', e);
        productos = [];
      }
    }

    // Si no hay items, intentar con 'productos_json' (compatibilidad hacia atrás)
    if (productos.length === 0 && pedido.productos_json) {
      try {
        const productosData = typeof pedido.productos_json === 'string' 
          ? JSON.parse(pedido.productos_json) 
          : pedido.productos_json;
        productos = Array.isArray(productosData) ? productosData : [];
      } catch (e) {
        console.error('Error parseando productos_json:', e);
        productos = [];
      }
    }

    // Obtener referencias de los productos desde la BD
    if (productos.length > 0) {
      // product_id es el que viene del metadata de Stripe (string o number)
      const productIds = productos
        .map((p: any) => p.product_id || p.id)
        .filter(Boolean)
        .map(id => parseInt(String(id), 10)); // Convertir a número para la búsqueda
      
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
            productosDb.map((p: any) => [p.id, p.referencia])
          );
          
          productos = productos.map((p: any) => {
            const id = parseInt(String(p.product_id || p.id), 10);
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
