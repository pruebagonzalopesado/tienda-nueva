import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async (context) => {
  try {
    // Obtener devoluciones de los últimos 30 días
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const { data: devoluciones, error } = await supabase
      .from('devoluciones')
      .select('estado, created_at, pedidos(total)')
      .gte('created_at', hace30Dias.toISOString());

    if (error) {
      throw error;
    }

    // Calcular estadísticas
    const stats = {
      totalDevoluciones: devoluciones?.length || 0,
      procesando: devoluciones?.filter(d => d.estado === 'procesado').length || 0,
      confirmadas: devoluciones?.filter(d => d.estado === 'confirmada').length || 0,
      rechazadas: devoluciones?.filter(d => d.estado === 'rechazada').length || 0,
      montoTotalDevoluciones: devoluciones?.reduce((sum, d) => sum + (d.pedidos?.total || 0), 0) || 0
    };

    // Obtener devoluciones pendientes (estado: procesado)
    const { data: pendientes } = await supabase
      .from('devoluciones')
      .select('id, pedido_id, usuario_nombre, created_at')
      .eq('estado', 'procesado')
      .order('created_at', { ascending: false })
      .limit(5);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        pendientes: pendientes || []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-returns-stats] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error al obtener estadísticas'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
