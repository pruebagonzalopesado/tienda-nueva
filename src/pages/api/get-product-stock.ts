import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const GET: APIRoute = async ({ url }) => {
  try {
    const productId = url.searchParams.get('id');

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'Falta el ID del producto' }),
        { status: 400 }
      );
    }

    const { data: product, error } = await supabase
      .from('products')
      .select('id, stock, nombre')
      .eq('id', parseInt(productId))
      .single();

    if (error || !product) {
      return new Response(
        JSON.stringify({ error: 'Producto no encontrado' }),
        { status: 404 }
      );
    }

    return new Response(
      JSON.stringify({
        id: product.id,
        nombre: product.nombre,
        stock: product.stock,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[get-product-stock] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno del servidor' }),
      { status: 500 }
    );
  }
};
