import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const GET: APIRoute = async () => {
  try {
    const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
    
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'STRIPE_SECRET_KEY not found' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[test-stripe] Stripe Key:', stripeKey.substring(0, 10) + '...');
    
    const stripe = new Stripe(stripeKey);
    
    // Try to create a test product
    const product = await stripe.products.create({
      name: 'Test Product',
      type: 'good',
    });

    console.log('[test-stripe] ✅ Product created:', product.id);

    // Delete the test product
    await stripe.products.del(product.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Stripe API is working',
        stripeKeyPrefix: stripeKey.substring(0, 10) + '...'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[test-stripe] ❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
