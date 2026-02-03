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

    if (!pedidoId || !email || !paymentIntentId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Parámetros requeridos faltantes',
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
          message: 'Pedido no encontrado',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. ACTUALIZAR ESTADO PRIMERO (rápido)
    await supabase
      .from('pedidos')
      .update({ estado: 'cancelado' })
      .eq('id', pedidoId);

    console.log('[cancel-order-mobile] Pedido actualizado a cancelado');

    // 2. PROCESAR REFUND (crítico)
    let refundProcessed = false;
    let refundAmount = 0;

    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
      });

      if (refund.id) {
        refundProcessed = true;
        refundAmount = refund.amount / 100;
        console.log('[cancel-order-mobile] ✅ Reembolso procesado:', refund.id);
      }
    } catch (refundError: any) {
      console.error('[cancel-order-mobile] Error refund:', refundError.message);
    }

    // 3. RESTAURAR STOCK EN PARALELO (no-crítico)
    try {
      const items = typeof pedido.items === 'string' ? JSON.parse(pedido.items) : pedido.items || [];
      
      for (const item of items) {
        if (item.product_id && item.cantidad) {
          supabase
            .from('productos')
            .update({ stock: supabase.rpc('increment_stock', { product_id: item.product_id, amount: item.cantidad }) })
            .eq('id', item.product_id)
            .then(() => {
              console.log(`[cancel-order-mobile] Stock restaurado para producto ${item.product_id}: +${item.cantidad}`);
            })
            .catch((err) => {
              console.warn(`[cancel-order-mobile] Error stock ${item.product_id}:`, err);
            });
        }
      }
    } catch (stockError) {
      console.error('[cancel-order-mobile] Error stock:', stockError);
    }

    // 4. ENVIAR EMAIL (no-crítico)
    if (refundProcessed) {
      const items = typeof pedido.items === 'string' ? JSON.parse(pedido.items) : pedido.items || [];
      
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
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
                  <p>Tu pedido #${pedidoId} ha sido cancelado y tu reembolso de €${refundAmount.toFixed(2)} ha sido procesado.</p>
                  <p>El reembolso aparecerá en tu cuenta en 5-10 días hábiles.</p>
                  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                    <p style="color: #666; font-size: 0.9em;">Joyería Galiana - info@galiana.es</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        }),
      }).catch((err) => console.warn('[cancel-order-mobile] Email error:', err));
    }

    // RESPONDER RÁPIDO
    return new Response(
      JSON.stringify({
        success: true,
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
        message: error.message || 'Error al procesar',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
