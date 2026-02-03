import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { pedidoId, email, nombre, paymentIntentId } = data;

    console.log('[cancel-order-mobile] Recibiendo solicitud de cancelación');
    console.log(`[cancel-order-mobile] Pedido ID: ${pedidoId}, Email: ${email}`);
    console.log(`[cancel-order-mobile] Payment Intent ID: ${paymentIntentId}`);

    if (!pedidoId || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Pedido ID y Email son requeridos',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Payment Intent ID es requerido para procesar refund',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener los datos del pedido
    const { data: pedido, error: fetchError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();

    if (fetchError || !pedido) {
      console.error('[cancel-order-mobile] Error al obtener pedido:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No se pudo obtener los datos del pedido',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Restaurar stock de cada producto
    try {
      let items = [];
      if (pedido.items) {
        items = typeof pedido.items === 'string' ? JSON.parse(pedido.items) : pedido.items;
      }

      console.log('[cancel-order-mobile] Restaurando stock para', items.length, 'productos');

      for (const item of items) {
        if (item.product_id) {
          const { data: productData, error: getError } = await supabase
            .from('productos')
            .select('stock, id')
            .eq('id', item.product_id)
            .single();

          if (!getError && productData) {
            const nuevoStock = (productData.stock || 0) + (item.cantidad || 1);

            const { error: updateStockError } = await supabase
              .from('productos')
              .update({ stock: nuevoStock })
              .eq('id', item.product_id);

            if (!updateStockError) {
              console.log(`[cancel-order-mobile] Stock restaurado para producto ${item.product_id}: +${item.cantidad}`);
            }
          }
        }
      }
    } catch (stockError) {
      console.error('[cancel-order-mobile] Error al procesar restauración de stock:', stockError);
    }

    // Actualizar estado del pedido a cancelado
    const { error: updateError } = await supabase
      .from('pedidos')
      .update({ estado: 'cancelado' })
      .eq('id', pedidoId);

    if (updateError) {
      console.error('[cancel-order-mobile] Error al actualizar pedido:', updateError);
    }

    console.log('[cancel-order-mobile] Pedido actualizado a cancelado');

    // ===== PROCESAR REEMBOLSO CON STRIPE =====
    let refundProcessed = false;
    let refundAmount = 0;

    try {
      if (paymentIntentId) {
        console.log('[cancel-order-mobile] Procesando refund para Payment Intent:', paymentIntentId);

        try {
          // ✅ IMPORTANTE: PASAR payment_intent al stripe.refunds.create()
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,  // ✅ AQUÍ VA EL paymentIntentId
            reason: 'requested_by_customer',
          });

          if (refund.id) {
            console.log('[cancel-order-mobile] ✅ Reembolso procesado:', refund.id);
            refundProcessed = true;
            refundAmount = refund.amount / 100;
          }
        } catch (refundError: any) {
          console.error('[cancel-order-mobile] Error procesando refund:', refundError.message);
        }
      }
    } catch (refundError) {
      console.warn('[cancel-order-mobile] Error al procesar reembolso de Stripe:', refundError);
    }

    // ===== ENVIAR EMAIL DE CANCELACIÓN =====
    try {
      if (refundProcessed) {
        const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': import.meta.env.BREVO_API_KEY || '',
          },
          body: JSON.stringify({
            to: [{ email: email, name: nombre }],
            sender: { name: 'Joyería Galiana', email: 'noreply@galiana.es' },
            subject: `Pedido Cancelado y Reembolso Procesado - Pedido #${pedidoId}`,
            htmlContent: `
              <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
                    <h1 style="color: #155724; margin-top: 0;">✅ Pedido Cancelado</h1>
                    <p>Hola <strong>${nombre}</strong>,</p>
                    <p>Tu pedido <strong>#${pedidoId}</strong> ha sido <strong>cancelado</strong> y tu reembolso ha sido <strong>procesado correctamente</strong>.</p>
                    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                      <p><strong>Detalles del Reembolso:</strong></p>
                      <p>
                        <strong>Monto Reembolsado:</strong> €${refundAmount.toFixed(2)}<br>
                        <strong>Número de Pedido:</strong> #${pedidoId}<br>
                        <strong>Fecha de Cancelación:</strong> ${new Date().toLocaleDateString('es-ES')}
                      </p>
                      <p style="color: #666; font-size: 0.9em;">
                        <em>El reembolso aparecerá en tu cuenta en 5-10 días hábiles.</em>
                      </p>
                    </div>
                    <p>Si tienes alguna pregunta, contacta con nosotros.</p>
                    <p style="color: #666; font-size: 0.9em; margin-top: 30px;">Joyería Galiana - info@galiana.es</p>
                  </div>
                </body>
              </html>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.warn('[cancel-order-mobile] Error sending email:', emailResponse.statusText);
        } else {
          console.log('[cancel-order-mobile] ✅ Email de cancelación enviado');
        }
      } else {
        console.warn('[cancel-order-mobile] No se envía email porque el reembolso no fue procesado');
      }
    } catch (emailError) {
      console.warn('[cancel-order-mobile] Error al enviar email:', emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pedido cancelado correctamente',
        refundProcessed,
        refundAmount,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[cancel-order-mobile] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Error al procesar la solicitud',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
