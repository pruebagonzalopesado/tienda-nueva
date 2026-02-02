import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Las variables privadas se acceden con import.meta.env en Astro
    const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
    
    console.log('[create-checkout] STRIPE_SECRET_KEY length:', stripeKey?.length);
    console.log('[create-checkout] STRIPE_SECRET_KEY prefix:', stripeKey?.substring(0, 15));
    
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY no encontrada');
      console.error('process.env:', Object.keys(process.env).filter(k => k.includes('STRIPE')));
      return new Response(
        JSON.stringify({ error: 'Stripe no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato de clave Stripe
    if (!stripeKey.startsWith('sk_test_') && !stripeKey.startsWith('sk_live_')) {
      console.error('[create-checkout] ❌ Formato de clave Stripe inválido. Debe empezar con sk_test_ o sk_live_');
      return new Response(
        JSON.stringify({ error: 'Clave Stripe configurada incorrectamente' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey);
    const data = await request.json();
    const { items, datosCliente, descuento, descuentoId, usuarioId } = data;
    
    console.log('[create-checkout] Datos recibidos:', { items, datosCliente, descuento, descuentoId, usuarioId });
    console.log('[create-checkout] items?.length:', items?.length);

    // Validar datos
    if (!items || items.length === 0) {
      console.error('[create-checkout] ❌ No hay productos en el carrito');
      return new Response(
        JSON.stringify({ error: 'No hay productos en el carrito' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calcular subtotal
    let subtotal = items.reduce((sum: number, item: any) => sum + (item.precio * item.cantidad), 0);
    
    // Calcular envío
    const envio = subtotal >= 100 ? 0 : 3;
    
    // Aplicar descuento si existe
    const descuentoAmount = descuento ? subtotal * (descuento / 100) : 0;

    // Crear line_items para Stripe con product_id en el metadata de cada línea
    const lineItems = items.map((item: any) => {
      const metadata: any = {
        product_id: item.id?.toString() || '',
        nombre: item.nombre || '',
        cantidad: item.cantidad?.toString() || '1',
        talla: item.talla || ''
      };
      
      // Procesar imagen: codificar espacios sin afectar la URL base
      let imagenUrl: string[] = [];
      console.log('[create-checkout] Procesando item:', item.nombre);
      console.log('[create-checkout] item.imagen:', item.imagen);
      console.log('[create-checkout] tipo de imagen:', typeof item.imagen);
      
      if (item.imagen && typeof item.imagen === 'string' && item.imagen.startsWith('http')) {
        try {
          // Usar encodeURI para codificar caracteres especiales (espacios, etc)
          // pero mantener la estructura de URL intacta
          const encodedUrl = encodeURI(item.imagen);
          imagenUrl = [encodedUrl];
          console.log('[create-checkout] ✅ Imagen codificada:', encodedUrl.substring(0, 100));
        } catch (e) {
          console.log('[create-checkout] ❌ Error codificando imagen:', e);
        }
      } else {
        console.log('[create-checkout] ⚠️ No se procesó imagen - condición no cumplida');
      }
      
      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.nombre,
            // Incluir imágenes si están disponibles y válidas
            ...(imagenUrl.length > 0 && { images: imagenUrl }),
          },
          unit_amount: Math.round(item.precio * 100), // En centavos
        },
        quantity: item.cantidad,
        metadata: metadata
      };
    });

    // Agregar envío si corresponde
    if (envio > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Gastos de envío',
          },
          unit_amount: envio * 100,
        },
        quantity: 1,
      });
    }

    // Crear sesión de Checkout
    let origin = request.headers.get('origin') || 'http://localhost:4322';
    
    // Limpiar origin si tiene / al final
    origin = origin.replace(/\/$/, '');
    
    // Asegurar que origin es válido
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
      origin = 'http://localhost:4322';
    }
    
    console.log('[create-checkout] origin:', origin);
    console.log('[create-checkout] origin cleaned:', origin);

    const successUrl = `${origin}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/pago`;
    
    console.log('[create-checkout] success_url:', successUrl);
    console.log('[create-checkout] cancel_url:', cancelUrl);
    console.log('[create-checkout] lineItems:', JSON.stringify(lineItems, null, 2));

    // Crear cupón si hay descuento
    let couponId = null;
    if (descuentoAmount > 0) {
      try {
        const coupon = await stripe.coupons.create({
          percent_off: descuento,
          duration: 'once',
          name: `Descuento ${descuento}%`,
        });
        couponId = coupon.id;
        console.log('[create-checkout] Cupón creado:', couponId);
      } catch (couponError) {
        console.error('[create-checkout] Error creando cupón:', couponError);
        // Continuar sin cupón si falla
      }
    }

    const sessionConfig: any = {
      line_items: lineItems,
      mode: 'payment',
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: datosCliente?.email,
      billing_address_collection: 'required',
      locale: 'es',
      metadata: {
        nombre: datosCliente?.nombre || '',
        telefono: datosCliente?.telefono || '',
        direccion: datosCliente?.direccion || '',
        ciudad: datosCliente?.ciudad || '',
        codigoPostal: datosCliente?.codigoPostal || '',
        pais: datosCliente?.pais || 'ES',
        descuento: descuento?.toString() || '0',
        descuentoId: descuentoId || '',
        usuarioId: usuarioId || '',
        // Solo guardar IDs y cantidades en metadata (más compacto, <= 500 caracteres)
        items_summary: items.map((i: any) => `${i.id}:${i.cantidad}`).join(','),
      },
    };

    // Agregar descuento si existe
    if (couponId) {
      sessionConfig.discounts = [{ coupon: couponId }];
    }

    console.log('[create-checkout] Creando sesión con config:', JSON.stringify({
      line_items_count: lineItems.length,
      has_email: !!datosCliente?.email,
      has_coupon: !!couponId,
      success_url: successUrl,
      cancel_url: cancelUrl
    }));

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('[create-checkout] ✅ Sesión creada:', session.id, 'URL:', session.url);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[create-checkout] ❌ Error:', error.message);
    console.error('[create-checkout] Full error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
