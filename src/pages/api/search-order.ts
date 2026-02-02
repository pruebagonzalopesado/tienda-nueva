import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, pedidoId } = await request.json();

    if (!email || !pedidoId) {
      return new Response(
        JSON.stringify({ error: 'Email y ID de pedido son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[search-order] Buscando pedido:', { email, pedidoId });

    // Buscar el pedido por ID y verificar que el email coincida
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      console.warn('[search-order] Error en la búsqueda:', error);
      return new Response(
        JSON.stringify({ error: 'No se encontró un pedido con esos datos' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!pedido) {
      console.log('[search-order] Pedido no encontrado');
      return new Response(
        JSON.stringify({ error: 'No se encontró un pedido con esos datos' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[search-order] ✅ Pedido encontrado');
    console.log('[search-order] Campos del pedido:', Object.keys(pedido));

    // Buscar información de devolución si existe
    let devolucion = null;
    const { data: devolucionData, error: devolucionError } = await supabase
      .from('devoluciones')
      .select('*')
      .eq('pedido_id', pedidoId)
      .single();

    if (!devolucionError && devolucionData) {
      console.log('[search-order] Devolución encontrada:', devolucionData);
      devolucion = devolucionData;
    } else {
      console.log('[search-order] No hay devolución registrada para este pedido');
    }

    // Agregar devolución al objeto pedido si existe
    if (devolucion) {
      (pedido as any).devolucion = {
        estado: devolucion.estado,
        motivo_solicitud: devolucion.motivo_solicitud,
        motivo_rechazo: devolucion.motivo_rechazo || null
      };
    }

    console.log('[search-order] Devolución:', (pedido as any).devolucion);

    return new Response(
      JSON.stringify({ 
        pedido: pedido,
        success: true 
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[search-order] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error al buscar el pedido',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
