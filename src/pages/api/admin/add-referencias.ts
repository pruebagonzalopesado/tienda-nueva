import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
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

    // Obtener todos los productos
    const { data: productos, error: getError } = await supabase
      .from('products')
      .select('*')
      .is('referencia', null);

    if (getError) {
      console.error('Error al obtener productos:', getError);
      return new Response(
        JSON.stringify({ error: 'Error al obtener productos', details: getError }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (productos && productos.length > 0) {
      // Actualizar cada producto sin referencia
      for (let i = 0; i < productos.length; i++) {
        const producto = productos[i];
        const referencia = `REF-${String(i + 1).padStart(4, '0')}`;

        const { error: updateError } = await supabase
          .from('products')
          .update({ referencia })
          .eq('id', producto.id);

        if (updateError) {
          console.error(`Error al actualizar producto ${producto.id}:`, updateError);
        }
      }
    }

    // Obtener el estado actual de todas las referencias
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, nombre, referencia');

    return new Response(
      JSON.stringify({ 
        success: true,
        productosActualizados: productos?.length || 0,
        productos: allProducts
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en add-referencias:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
