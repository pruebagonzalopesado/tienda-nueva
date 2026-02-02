import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async ({ request }) => {
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ productos: 0, ofertas: 0, galeria: 0, pedidos: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { count: productos } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true });

    const { count: ofertas } = await supabase
      .from('offers')
      .select('id', { count: 'exact', head: true });

    const { count: galeria } = await supabase
      .from('gallery_slides')
      .select('id', { count: 'exact', head: true });

    const { count: pedidos } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true });

    return new Response(
      JSON.stringify({ 
        productos: productos || 0,
        ofertas: ofertas || 0,
        galeria: galeria || 0,
        pedidos: pedidos || 0
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en get-stats:', error);
    return new Response(
      JSON.stringify({ productos: 0, ofertas: 0, galeria: 0, pedidos: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
