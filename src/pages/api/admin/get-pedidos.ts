import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async ({ request }) => {
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase no configurado', pedidos: [] }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener parámetros de paginación
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const offset = (page - 1) * pageSize;

    // Obtener pedidos
    const { data: pedidos, error, count } = await supabase
      .from('pedidos')
      .select('id, email, nombre, total, estado, fecha_creacion', { count: 'exact' })
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error al obtener pedidos:', error);
      return new Response(
        JSON.stringify({ error: 'Error al obtener pedidos', pedidos: [] }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        pedidos: pedidos || [],
        total: count || 0,
        page,
        pageSize
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en get-pedidos:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', pedidos: [] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
