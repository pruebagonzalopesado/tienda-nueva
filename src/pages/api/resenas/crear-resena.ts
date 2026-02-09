import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      product_id,
      pedido_id,
      usuario_id,
      usuario_nombre,
      usuario_email,
      calificacion,
      titulo,
      comentario
    } = body;

    // Validaciones básicas
    if (!product_id || !pedido_id || !usuario_id || !calificacion) {
      return new Response(
        JSON.stringify({ error: 'Datos incompletos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (calificacion < 1 || calificacion > 5) {
      return new Response(
        JSON.stringify({ error: 'Calificación debe estar entre 1 y 5' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[crear-resena] Creando reseña para:', {
      product_id,
      pedido_id,
      usuario_id,
      calificacion
    });

    // ✅ VALIDACIÓN 1: Verificar que el pedido existe y pertenece al usuario
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, items, email')
      .eq('id', pedido_id)
      .eq('email', usuario_email)
      .single();

    if (pedidoError || !pedido) {
      console.error('[crear-resena] Pedido no encontrado para usuario:', usuario_email);
      return new Response(
        JSON.stringify({ error: 'Pedido no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ✅ VALIDACIÓN 2: Verificar que el producto está en el pedido
    let items = [];
    try {
      items = typeof pedido.items === 'string'
        ? JSON.parse(pedido.items)
        : (pedido.items || []);
    } catch (e) {
      console.error('[crear-resena] Error parseando items:', e);
      items = [];
    }

    console.log('[crear-resena] Items en pedido:', JSON.stringify(items));
    console.log('[crear-resena] Buscando product_id:', product_id, 'tipo:', typeof product_id);

    const productIdInt = parseInt(product_id);
    const productoEnPedido = items.some((item: any) => {
      // El item puede tener 'id' o 'product_id'
      const itemId = item.id !== undefined ? item.id : item.product_id;
      
      // Comparar como números
      if (itemId !== undefined && itemId !== null) {
        const itemIdInt = parseInt(itemId);
        const match = itemIdInt === productIdInt && !isNaN(itemIdInt) && !isNaN(productIdInt);
        console.log('[crear-resena] Item:', { 
          itemOriginal: itemId, 
          itemInt: itemIdInt, 
          productInt: productIdInt, 
          match 
        });
        return match;
      }
      return false;
    });

    if (!productoEnPedido) {
      console.error('[crear-resena] Producto no encontrado. Buscado:', productIdInt);
      console.error('[crear-resena] Items disponibles:', items.map((i: any) => ({ id: i.id, product_id: i.product_id, nombre: i.nombre })));
      return new Response(
        JSON.stringify({ error: 'Este producto no está en tu pedido' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ✅ VALIDACIÓN 3: Verificar que no exista reseña duplicada
    const { data: existente } = await supabase
      .from('resenas')
      .select('id')
      .eq('product_id', product_id)
      .eq('usuario_id', usuario_id)
      .eq('pedido_id', pedido_id)
      .single();

    if (existente) {
      console.error('[crear-resena] Reseña ya existe');
      return new Response(
        JSON.stringify({ error: 'Ya has dejado una reseña para este producto' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Crear la reseña
    const { data: resena, error: createError } = await supabase
      .from('resenas')
      .insert([
        {
          product_id: parseInt(product_id),
          pedido_id,
          usuario_id,
          usuario_nombre: usuario_nombre || 'Cliente',
          usuario_email,
          calificacion: parseInt(calificacion),
          titulo: titulo || '',
          comentario: comentario || '',
          compra_verificada: true,
          estado: 'aprobado', // En producción podrías usar 'pendiente' para moderación
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (createError || !resena) {
      console.error('[crear-resena] Error creando reseña:', createError);
      return new Response(
        JSON.stringify({ error: 'Error al crear la reseña' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[crear-resena] ✅ Reseña creada exitosamente:', resena.id);

    return new Response(
      JSON.stringify({
        success: true,
        resena,
        mensaje: '¡Gracias! Tu reseña ha sido publicada'
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[crear-resena] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Error internal del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
