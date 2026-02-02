import type { APIRoute } from 'astro';
import { sendPaymentSuccessEmail } from '../../lib/brevo';

/**
 * Endpoint de prueba para enviar email de pago
 * GET /api/test-payment-email?email=test@example.com&nombre=Test
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    const nombre = url.searchParams.get('nombre') || 'Cliente';

    if (!email) {
      return new Response(JSON.stringify({ 
        error: 'Email requerido: /api/test-payment-email?email=test@example.com&nombre=Test' 
      }), { status: 400 });
    }

    console.log('🧪 TEST: Enviando email de prueba a:', email);

    const result = await sendPaymentSuccessEmail(
      email,
      nombre,
      'TEST-' + Date.now(),
      99.99,
      undefined,
      { subtotal: 89.99, envio: 10.00 }
    );

    console.log('🧪 TEST: Resultado:', result);

    return new Response(JSON.stringify(result), { 
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('🧪 TEST ERROR:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { status: 500 });
  }
};
