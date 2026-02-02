import { supabase } from '../../lib/supabase';

export async function GET({ url }) {
  try {
    const productId = url.searchParams.get('id');
    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID required' }), { status: 400 });
    }

    console.log('[get-product-image] Buscando product_id:', productId, 'tipo:', typeof productId);

    const { data, error } = await supabase
      .from('products')
      .select('imagen_url')
      .eq('id', parseInt(productId))
      .single();

    if (error) {
      console.error('[get-product-image] Error DB:', error);
      throw error;
    }

    console.log('[get-product-image] Data crudo:', data);
    console.log('[get-product-image] imagen_url:', data?.imagen_url);
    console.log('[get-product-image] tipo imagen_url:', typeof data?.imagen_url);

    // imagen_url puede ser JSON array string o URL string
    let imagen = null;
    if (data?.imagen_url) {
      try {
        // Intentar parsear como JSON
        const parsed = JSON.parse(data.imagen_url);
        console.log('[get-product-image] Parseado:', parsed);
        imagen = Array.isArray(parsed) ? parsed[0] : parsed;
      } catch (e) {
        // Si no es JSON, es un string directo
        console.log('[get-product-image] No es JSON, usando como string');
        imagen = data.imagen_url;
      }
    }

    console.log('[get-product-image] Imagen final retornada:', imagen);

    return new Response(JSON.stringify({ imagen }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[get-product-image] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error fetching product image' }), { status: 500 });
  }
}
