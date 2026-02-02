import { supabase } from '../../../lib/supabase';

export const prerender = false;

export async function GET({ request }: { request: Request }) {
  try {
    // Verificar que hay sesión
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[debug-sales] Headers recibidos, extrayendo token...');

    // Debug: obtener todos los pedidos directamente (sin filtrar por estado)
    const { data: allOrders, error: errorAll } = await supabase!
      .from('pedidos')
      .select('*')
      .order('fecha_creacion', { ascending: false })
      .limit(5);

    console.log('[debug-sales] Todos los pedidos (últimos 5):', allOrders);
    console.log('[debug-sales] Error:', errorAll);

    // Obtener estados únicos
    const { data: allStates } = await supabase!
      .from('pedidos')
      .select('estado');

    const uniqueStates = [...new Set((allStates || []).map(p => p.estado))];
    console.log('[debug-sales] Estados únicos:', uniqueStates);

    return new Response(JSON.stringify({
      success: true,
      totalPedidos: allOrders?.length || 0,
      ultimosPedidos: allOrders,
      estadosUnicos: uniqueStates,
      error: errorAll
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[debug-sales] Error:', error);
    return new Response(JSON.stringify({ error: 'Error al obtener datos', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
