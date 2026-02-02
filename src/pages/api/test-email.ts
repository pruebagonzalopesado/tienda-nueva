import type { APIRoute } from 'astro';
import { sendPaymentSuccessEmail } from '../../lib/brevo';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { email, nombre, orderId, amount, items = [] } = data;

    console.log('🧪 TEST EMAIL - Datos recibidos:', { email, nombre, orderId, amount, items });

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email requerido', received: data }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Preparar datos del pedido para el email
    const pedidoData = items.length > 0 ? {
      items: items,
      subtotal: items.reduce((sum: number, item: any) => sum + ((item.precio || 0) * (item.cantidad || 1)), 0),
      envio: data.envio || 0
    } : undefined;

    const result = await sendPaymentSuccessEmail(
      email,
      nombre || 'Cliente',
      orderId || 'TEST-' + Date.now(),
      parseFloat(amount) || 99.99,
      undefined,
      pedidoData
    );

    console.log('🧪 TEST EMAIL - Resultado:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email de prueba enviado',
        result: result 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('🧪 TEST EMAIL - Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
