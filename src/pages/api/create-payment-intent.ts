import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Obtener clave secreta de Stripe
    const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
    
    if (!stripeKey) {
      console.error('[create-payment-intent] STRIPE_SECRET_KEY no encontrada');
      return new Response(
        JSON.stringify({ error: 'Stripe no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato de clave
    if (!stripeKey.startsWith('sk_test_') && !stripeKey.startsWith('sk_live_')) {
      console.error('[create-payment-intent] Clave Stripe inválida');
      return new Response(
        JSON.stringify({ error: 'Clave Stripe configurada incorrectamente' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey);

    // Obtener datos de la solicitud
    const data = await request.json();
    const { amount, email, nombre, currency = 'eur', metadata = {} } = data;

    console.log('[create-payment-intent] >>> Creando Payment Intent');
    console.log('[create-payment-intent]     - Monto: €' + amount);
    console.log('[create-payment-intent]     - Email: ' + email);
    console.log('[create-payment-intent]     - Nombre: ' + nombre);

    // Validar datos requeridos
    if (!amount || !email || !nombre) {
      console.error('[create-payment-intent] Datos incompletos');
      return new Response(
        JSON.stringify({ error: 'Datos incompletos: amount, email y nombre son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Crear Payment Intent en Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convertir euros a céntimos
      currency: currency.toLowerCase(),
      receipt_email: email,
      description: `Pago de ${nombre} - Joyería Galiana`,
      metadata: {
        email,
        nombre,
        ...metadata,
      },
      statement_descriptor_suffix: 'GALIANA',
    });

    console.log('[create-payment-intent] ✅ Payment Intent creado:', paymentIntent.id);

    return new Response(
      JSON.stringify({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  } catch (error: any) {
    console.error('[create-payment-intent] ❌ Error:', error.message);
    console.error('[create-payment-intent] Stack:', error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { 
        status: 400, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    );
  }
};