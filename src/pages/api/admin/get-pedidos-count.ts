import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async ({ request }) => {
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase no configurado');
      return new Response(
        JSON.stringify({ count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener el total de pedidos
    const { count, error } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('Error al contar pedidos:', error);
      return new Response(
        JSON.stringify({ count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ count: count || 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en get-pedidos-count:', error);
    return new Response(
      JSON.stringify({ count: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
