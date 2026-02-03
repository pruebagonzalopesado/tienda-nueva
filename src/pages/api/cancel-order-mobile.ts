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
        const items = typeof pedido.items === 'string' ? JSON.parse(pedido.items) : pedido.items || [];
        
        const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': import.meta.env.BREVO_API_KEY || '',
          },
          body: JSON.stringify({
            to: [{ email: email, name: nombre }],
            sender: { name: 'Joyería Galiana', email: 'reportsanlucar@gmail.com' },
            subject: `Pedido Cancelado y Reembolso Procesado - Pedido #${pedidoId}`,
            htmlContent: `
              <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
                    <h1 style="color: #8B4444; text-align: center;">Joyería Galiana</h1>
                    <h2 style="color: #D4AF37; text-align: center;">Pedido Cancelado</h2>
                    
                    <p>Hola <strong>${nombre}</strong>,</p>
                    
                    <p>Tu pedido ha sido cancelado correctamente y tu reembolso ha sido procesado.</p>
                    
                    <div style="background-color: white; padding: 15px; border-left: 4px solid #D4AF37; margin: 20px 0;">
                      <p><strong>Número de pedido:</strong> #${pedidoId}</p>
                      <p><strong>Fecha de cancelación:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
                      <p><strong>Estado:</strong> Cancelado</p>
                    </div>
                    
                    <h3 style="color: #8B4444;">Detalles del reembolso:</h3>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                      <tr style="background-color: #f0f0f0;">
                        <th style="padding: 10px; text-align: left;">Producto</th>
                        <th style="padding: 10px; text-align: center;">Cantidad</th>
                        <th style="padding: 10px; text-align: right;">Precio</th>
                      </tr>
                      ${items
                        .map(
                          (item: any) =>
                            `<tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.nombre}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.cantidad}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">€${(item.precio * item.cantidad).toFixed(2)}</td>
                      </tr>`
                        )
                        .join('')}
                    </table>
                    
                    <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
                      <p style="margin: 5px 0;"><strong>Monto reembolsado:</strong> €${refundAmount.toFixed(2)}</p>
                      <p style="margin: 5px 0; font-size: 1.2em; color: #D4AF37;"><strong>Total: €${refundAmount.toFixed(2)}</strong></p>
                    </div>
                    
                    <p>El reembolso aparecerá en tu cuenta en 5-10 días hábiles.</p>
                    
                    <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                      <p style="color: #666; font-size: 0.9em;">
                        Joyería Galiana<br>
                        info@galiana.es
                      </p>
                    </div>
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
