import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
    
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY no encontrada');
      return new Response(
        JSON.stringify({ error: 'Stripe no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey);
    const data = await request.json();
    const { sessionId } = data;

    console.log('Procesando sesión:', sessionId);

    // Obtener detalles de la sesión de Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer_details']
    });

    console.log('Session payment_status:', session.payment_status);

    if (session.payment_status !== 'paid') {
      console.error('Payment no completado. Status:', session.payment_status);
      return new Response(
        JSON.stringify({ error: 'El pago no ha sido completado. Status: ' + session.payment_status }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener líneas del pedido
    const lineItems = session.line_items?.data || [];
    const metadata = session.metadata || {};
    const amount = session.amount_total || 0;

    console.log('Line items:', lineItems.length);
    console.log('Metadata:', metadata);

    // Procesar productos y calcular totales
    const productos = [];
    let totalEnvio = 0;

    for (const item of lineItems) {
      const productName = item.description || 'Producto';
      const cantidad = item.quantity || 1;
      const precioUnitario = (item.price?.unit_amount || 0) / 100;

      // Detectar si es envío
      if (productName.toLowerCase().includes('envío') || productName.toLowerCase().includes('shipping')) {
        totalEnvio = precioUnitario * cantidad;
      } else {
        productos.push({
          nombre: productName,
          cantidad: cantidad,
          precio: precioUnitario,
          subtotal: precioUnitario * cantidad,
          product_id: item.price?.metadata?.product_id
        });

        // Restar stock
        if (item.price?.metadata?.product_id) {
          await restarStock(item.price.metadata.product_id, cantidad);
        }
      }
    }

    // Crear pedido en base de datos
    const subtotal = (amount - Math.round(totalEnvio * 100)) / 100;
    const pedido = {
      email: session.customer_email || metadata.email,
      nombre_cliente: metadata.nombre || session.customer_details?.name,
      telefono: metadata.telefono,
      direccion: metadata.direccion,
      ciudad: metadata.ciudad,
      codigo_postal: metadata.codigoPostal,
      pais: metadata.pais || 'ES',
      subtotal: subtotal,
      envio: totalEnvio,
      descuento: metadata.descuento ? parseFloat(metadata.descuento) : 0,
      total: amount / 100,
      estado: 'confirmado',
      metodo_pago: 'stripe',
      stripe_session_id: sessionId,
      productos_json: JSON.stringify(productos),
      notas: `Pedido completado automáticamente`
    };

    console.log('Insertando pedido:', pedido);

    const { data: insertedOrder, error: pedidoError } = await supabase!
      .from('pedidos')
      .insert([pedido])
      .select();

    if (pedidoError) {
      console.error('Error inserting order:', pedidoError);
      return new Response(
        JSON.stringify({ error: 'Error al crear el pedido: ' + pedidoError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Pedido creado exitosamente:', insertedOrder);

    return new Response(
      JSON.stringify({
        success: true,
        order: insertedOrder?.[0],
        products: productos,
        total: amount / 100
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error processing order:', error);
    return new Response(
      JSON.stringify({ error: 'Error procesando pedido: ' + error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

async function restarStock(productId: string, cantidad: number) {
  try {
    // Obtener stock actual
    const { data: producto } = await supabase!
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();

    if (producto) {
      const nuevoStock = Math.max(0, (producto.stock || 0) - cantidad);
      await supabase!
        .from('products')
        .update({ stock: nuevoStock })
        .eq('id', productId);

      console.log(`Stock actualizado para ${productId}: ${producto.stock} -> ${nuevoStock}`);
    }
  } catch (error) {
    console.error('Error restando stock:', error);
  }
}
