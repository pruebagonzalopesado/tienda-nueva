import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { sendPaymentSuccessEmail } from '../../lib/brevo';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { email, nombre, orderId, amount } = data;

    console.log('🧪 TEST PAYMENT WEBHOOK - Simulando pago completado');
    console.log('📧 Email:', email);
    console.log('👤 Nombre:', nombre);
    console.log('📋 Order ID:', orderId);
    console.log('💰 Amount:', amount);

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insertar un pedido de prueba
    const pedido = {
      email: email,
      nombre_cliente: nombre,
      total: parseFloat(amount) || 99.99,
      estado: 'confirmado',
      metodo_pago: 'stripe_test',
      stripe_session_id: orderId,
      fecha_pedido: new Date().toISOString(),
      notas: 'Pedido de prueba desde test-payment-webhook'
    };

    console.log('💾 Insertando pedido de prueba:', pedido);

    const { data: insertedOrder, error: orderError } = await supabase!
      .from('pedidos')
      .insert([pedido])
      .select();

    if (orderError) {
      console.error('❌ Error insertando pedido:', orderError);
      throw orderError;
    }

    console.log('✅ Pedido insertado:', insertedOrder);

    // Ahora enviar el email
    console.log('📧 Enviando email de pago exitoso a:', email);

    const emailResult = await sendPaymentSuccessEmail(
      email,
      nombre || 'Cliente',
      orderId,
      parseFloat(amount) || 99.99,
      undefined,
      { subtotal: parseFloat(amount) || 99.99, envio: 0 }
    );

    console.log('📧 Resultado del email:', emailResult);

    if (emailResult.success) {
      console.log('✅ Email enviado exitosamente:', emailResult.messageId);
    } else {
      console.error('❌ Error al enviar email:', emailResult.error);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Pago de prueba procesado',
        order: insertedOrder,
        email: emailResult
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Error en test webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
