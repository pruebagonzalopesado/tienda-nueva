import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get('product_id');

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'product_id requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[obtener-resenas] Obteniendo reseñas para producto:', productId);

    // Obtener reseñas aprobadas ordenadas por más recientes
    const { data: resenas, error } = await supabase
      .from('resenas')
      .select('*')
      .eq('product_id', parseInt(productId))
      .eq('estado', 'aprobado')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[obtener-resenas] Error:', error);
      return new Response(
        JSON.stringify({ error: 'Error al obtener reseñas' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calcular estadísticas
    const total = resenas?.length || 0;
    const promedio = total > 0
      ? (resenas!.reduce((sum, r) => sum + r.calificacion, 0) / total).toFixed(1)
      : '0';

    const distribucion = {
      5: resenas?.filter(r => r.calificacion === 5).length || 0,
      4: resenas?.filter(r => r.calificacion === 4).length || 0,
      3: resenas?.filter(r => r.calificacion === 3).length || 0,
      2: resenas?.filter(r => r.calificacion === 2).length || 0,
      1: resenas?.filter(r => r.calificacion === 1).length || 0
    };

    return new Response(
      JSON.stringify({
        resenas: resenas || [],
        estadisticas: {
          total,
          promedio: parseFloat(promedio as string),
          distribucion
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[obtener-resenas] Error inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
