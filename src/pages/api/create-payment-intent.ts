import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  try {
    const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
    
    if (!stripeKey) {
      console.error('[create-payment-intent] STRIPE_SECRET_KEY no encontrada');
      return new Response(
        JSON.stringify({ error: 'Stripe no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!stripeKey.startsWith('sk_test_') && !stripeKey.startsWith('sk_live_')) {
      console.error('[create-payment-intent] Clave Stripe inválida');
      return new Response(
        JSON.stringify({ error: 'Clave Stripe configurada incorrectamente' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey);

    const data = await request.json();
    const { amount, email, nombre, currency = 'eur', metadata = {} } = data;

    console.log('[create-payment-intent] >>> Creando Payment Intent');
    console.log('[create-payment-intent]     - Monto: €' + amount);
    console.log('[create-payment-intent]     - Email: ' + email);
    console.log('[create-payment-intent]     - Nombre: ' + nombre);

    if (!amount || !email || !nombre) {
      console.error('[create-payment-intent] Datos incompletos');
      return new Response(
        JSON.stringify({ error: 'Datos incompletos: amount, email y nombre son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ✅ SIN payment_method_types - Stripe lo detecta automáticamente
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      receipt_email: email,
      description: `Pago de ${nombre} - Joyería Galiana`,
      metadata: {
        email,
        nombre,
        ...metadata,
      },
      statement_descriptor_suffix: 'GALIANA',
      automatic_payment_methods: {
        enabled: true,
      },
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