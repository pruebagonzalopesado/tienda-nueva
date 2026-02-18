import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';
import { sendPaymentSuccessEmail } from '../../lib/brevo';
import { generateInvoicePDF, obtenerDatosProducto } from '../../lib/invoice-generator';

import { isDev } from '../../lib/debug';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  if (isDev) console.log('🔔 WEBHOOK STRIPE - Solicitud recibida');
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (isDev) {
    console.log('🔑 Stripe signature:', sig ? 'presente' : 'FALTA');
    console.log('🔐 Webhook secret configurado:', webhookSecret ? 'SÍ' : 'NO');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret!);
    if (isDev) {
      console.log('✅ Firma verificada correctamente');
      console.log('📨 Tipo de evento:', event.type);
    }
  } catch (err: any) {
    console.error('❌ Error de verificación de firma webhook');
    if (isDev) {
      console.error('Detalles:', err.message);
    }
    return new Response(JSON.stringify({ error: 'Webhook signature verification failed' }), { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        if (isDev) console.log('🛒 Procesando: checkout.session.completed');
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.succeeded':
        if (isDev) console.log('💳 Procesando: payment_intent.succeeded');
        break;
      default:
        if (isDev) console.log('⚠️ Evento no manejado:', event.type);
    }

    if (isDev) console.log('✅ Webhook procesado exitosamente');
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('❌ Error procesando webhook');
    if (isDev) console.error('Detalles:', error.message);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), { status: 500 });
  }
};

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    // Obtener los detalles de la sesión
    const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items', 'customer_details']
    });

    const lineItems = expandedSession.line_items?.data || [];
    
    // Guardar el Session ID - usaremos esto para obtener el Payment Intent después
    const sessionId = session.id;
    
    console.log('💳 Checkout Session ID guardado:', sessionId);
    
    // Intentar obtener el email de múltiples fuentes
    let customerEmail = expandedSession.customer_email;
    if (!customerEmail && expandedSession.customer_details?.email) {
      customerEmail = expandedSession.customer_details.email;
    }
    if (!customerEmail && expandedSession.metadata?.email) {
      customerEmail = expandedSession.metadata.email;
    }
    
    const customerName = expandedSession.customer_details?.name;
    const amount = expandedSession.amount_total || 0;

    // Log para depuración (solo en desarrollo)
    if (isDev) {
      console.log('=== WEBHOOK CHECKOUT SESSION ===');
      console.log('Session ID:', session.id);
      console.log('Customer Email (final):', customerEmail);
      console.log('Customer Name:', customerName);
      console.log('Amount:', amount);
    }

    // Obtener metadata del pedido
    const metadata = expandedSession.metadata || {};
    console.log('Metadata:', metadata);
    
    // Obtener el user_id si está disponible en metadata
    let userId = metadata.user_id;

    // Si no hay user_id en metadata, intentar obtenerlo por email
    if (!userId && customerEmail) {
      const { data: user } = await supabase!
        .from('usuarios')
        .select('id')
        .eq('email', customerEmail)
        .single();
      
      if (user) {
        userId = user.id;
      }
    }

    // Procesar cada línea del pedido (productos + envío)
    const productos = [];
    let totalEnvio = 0;

    for (const item of lineItems) {
      const productName = item.description || item.price?.metadata?.nombre || 'Producto';
      const cantidad = item.quantity || 1;
      const precioUnitario = (item.price?.unit_amount || 0) / 100;

      // Detectar si es envío o producto
      if (productName.toLowerCase().includes('envío') || productName.toLowerCase().includes('shipping')) {
        totalEnvio = precioUnitario * cantidad;
      } else {
        // Obtener el product_id desde metadata del price (donde está toda la info)
        const productId = item.price?.metadata?.product_id;
        const nombre = item.price?.metadata?.nombre || productName;
        const talla = item.price?.metadata?.talla;
        
        if (productId) {
          productos.push({
            product_id: productId,
            nombre: nombre,
            cantidad: cantidad,
            precio_unitario: precioUnitario,
            subtotal: precioUnitario * cantidad,
            talla: talla
          });

          // Restar stock del producto
          await actualizarStock(productId, cantidad);
        }
      }
    }

    // Insertar el pedido en la tabla pedidos
    const pedido = {
      user_id: userId || null,
      email: customerEmail,
      nombre_cliente: customerName || metadata.nombre,
      telefono: metadata.telefono,
      direccion: metadata.direccion,
      ciudad: metadata.ciudad,
      codigo_postal: metadata.codigoPostal,
      pais: metadata.pais || 'ES',
      subtotal: (amount - totalEnvio * 100) / 100,
      envio: totalEnvio,
      total: amount / 100,
      estado: 'confirmado',
      metodo_pago: 'stripe',
      stripe_session_id: session.id,
      stripe_payment_id: sessionId,
      productos_json: JSON.stringify(productos),
      fecha_pedido: new Date().toISOString(),
      notas: `Pedido completado a través de Stripe. Session: ${session.id}`
    };

    const { error: pedidoError } = await supabase!
      .from('pedidos')
      .insert([pedido]);

    if (pedidoError) {
      console.error('Error inserting order:', pedidoError);
      throw pedidoError;
    }

    console.log('Order created successfully:', session.id);

    // Enviar correo de pago exitoso
    if (!customerEmail) {
      console.warn('⚠️ No customer email found, skipping email');
    } else {
      try {
        console.log('Enviando email a:', customerEmail);
        
        // Generar la factura en PDF (opcional, no bloquea el envío)
        let pdfBuffer: Buffer | undefined;
        
        // Intentar obtener items del carrito desde metadata
        let cartItems: any[] = [];
        
        // Nuevamente: items_summary es formato "id:cantidad,id:cantidad"
        if (metadata.items_summary) {
          try {
            const pairs = metadata.items_summary.split(',');
            cartItems = pairs.map(pair => {
              const [id, cantidad] = pair.split(':');
              return { id: parseInt(id), cantidad: parseInt(cantidad) };
            });
          } catch (e) {
            console.warn('No se pudo parsear items_summary de metadata:', e);
          }
        }
        // Fallback: intenta parsear items si existe (para compatibilidad)
        else if (metadata.items) {
          try {
            cartItems = typeof metadata.items === 'string' ? JSON.parse(metadata.items) : metadata.items;
          } catch (e) {
            console.warn('No se pudo parsear items de metadata');
          }
        }
        
        // Enriquecer datos de productos con información detallada
        const productosConDetalles: any[] = [];
        for (const prod of productos) {
          const detalles = await obtenerDatosProducto(prod.product_id);
          
          // Intentar obtener la talla del carrito
          const cartItem = cartItems.find((item: any) => item.id === prod.product_id);
          const talla = cartItem?.talla;
          
          productosConDetalles.push({
            id: prod.product_id,
            nombre: detalles?.nombre || prod.product_id,
            cantidad: prod.cantidad,
            precio_unitario: prod.precio_unitario,
            subtotal: prod.subtotal,
            imagen_url: detalles?.imagen_url,
            talla: talla
          });
        }

        // Generar factura PDF
        try {
          console.log('Generando factura PDF...');
          
          const datosFactura = {
            numero_pedido: session.id,
            fecha: new Date(),
            cliente: {
              nombre: customerName || metadata.nombre || 'Cliente',
              email: customerEmail,
              telefono: metadata.telefono || 'No proporcionado',
              direccion: metadata.direccion || 'No proporcionada',
              ciudad: metadata.ciudad || 'No proporcionada',
              codigo_postal: metadata.codigoPostal || 'No proporcionado',
              pais: metadata.pais || 'ES'
            },
            productos: productosConDetalles,
            subtotal: (amount - Math.round(totalEnvio * 100)) / 100,
            envio: totalEnvio,
            descuento: metadata.descuento ? parseFloat(metadata.descuento) : 0,
            total: amount / 100
          };

          pdfBuffer = await generateInvoicePDF(datosFactura);
          console.log('✅ Factura PDF generada exitosamente');
        } catch (pdfError) {
          console.error('⚠️ Error generando PDF de factura:', pdfError);
          // Continuar sin PDF, no es un error crítico
        }

        // Preparar datos del pedido para el email (sin items, solo total)
        const pedidoData = {
          numero_pedido: session.id,
          subtotal: (amount - Math.round(totalEnvio * 100)) / 100,
          envio: totalEnvio
        };

        const emailResult = await sendPaymentSuccessEmail(
          customerEmail,
          customerName || metadata.nombre || 'Cliente',
          session.id as any,
          amount / 100,
          pdfBuffer,
          pedidoData
        );

        if (emailResult.success) {
          console.log('✅ Correo de pago enviado exitosamente:', emailResult.messageId);
        } else {
          console.error('❌ Error al enviar correo de pago:', emailResult.error);
        }
      } catch (err) {
        console.error('❌ Excepción al enviar correo de pago:', err);
      }
    }

    // Limpiar carrito del usuario si existe
    if (userId) {
      await supabase!
        .from('carrito')
        .delete()
        .eq('user_id', userId);
      
      console.log('Cart cleared for user:', userId);
    }

  } catch (error: any) {
    console.error('Error handling checkout session:', error);
    throw error;
  }
}

async function actualizarStock(productId: string, cantidad: number) {
  try {
    // Obtener el stock actual
    const { data: producto, error: fetchError } = await supabase!
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();

    if (fetchError || !producto) {
      console.error('Error fetching product:', fetchError);
      return;
    }

    const nuevoStock = Math.max(0, (producto.stock || 0) - cantidad);

    // Actualizar el stock
    const { error: updateError } = await supabase!
      .from('products')
      .update({ stock: nuevoStock })
      .eq('id', productId);

    if (updateError) {
      console.error('Error updating stock:', updateError);
      return;
    }

    console.log(`Stock updated for product ${productId}: ${producto.stock} -> ${nuevoStock}`);
  } catch (error: any) {
    console.error('Error in actualizarStock:', error);
  }
}
