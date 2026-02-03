import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Obtener stock real en tiempo real de la BD
 * Se ejecuta constantemente desde el cliente
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const productIds = url.searchParams.get('ids')?.split(',') || [];

    if (productIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Se requieren IDs de productos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener stock actual de todos los productos solicitados
    const { data: products, error } = await supabase
      .from('products')
      .select('id, stock, nombre')
      .in('id', productIds.map(id => parseInt(id)));

    if (error) {
      console.error('[get-real-stock] Error:', error);
      return new Response(
        JSON.stringify({ error: 'Error al obtener stock' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mapear a objeto para acceso rápido
    const stockMap = {};
    products?.forEach(p => {
      stockMap[p.id] = {
        id: p.id,
        nombre: p.nombre,
        stock: p.stock || 0
      };
    });

    return new Response(
      JSON.stringify({ success: true, stock: stockMap }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        } 
      }
    );
  } catch (err: any) {
    console.error('[get-real-stock] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
