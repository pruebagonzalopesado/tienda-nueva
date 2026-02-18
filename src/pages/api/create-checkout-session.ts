import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { isDev } from '../../lib/debug';


// Dominios permitidos para redirección de Stripe
const ALLOWED_ORIGINS = [
  'http://localhost:4321',
  'http://localhost:4322',
  'http://localhost:3000',
  'https://galiana.victoriafp.online',
];

export const POST: APIRoute = async ({ request }) => {
  try {
    // Las variables privadas se acceden con import.meta.env en Astro
    const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
    
    if (isDev) {
      console.log('[create-checkout] STRIPE_SECRET_KEY configurada:', !!stripeKey);
    }
    
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY no encontrada');
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
    
    if (isDev) {
      console.log('[create-checkout] items?.length:', items?.length);
    }

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
      
      if (item.imagen && typeof item.imagen === 'string' && item.imagen.startsWith('http')) {
        try {
          const encodedUrl = encodeURI(item.imagen);
          imagenUrl = [encodedUrl];
        } catch (e) {
          if (isDev) console.log('[create-checkout] ❌ Error codificando imagen:', e);
        }
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

    // Crear sesión de Checkout - validar origin
    let origin = request.headers.get('origin') || '';
    origin = origin.replace(/\/$/, '');
    
    // Validar que el origin es uno de los permitidos
    if (!ALLOWED_ORIGINS.includes(origin)) {
      const prodOrigin = ALLOWED_ORIGINS.find(o => o.startsWith('https://'));
      if (!prodOrigin) {
        // En desarrollo, si no hay dominio https, usar localhost como fallback
        if (isDev) {
          const localhost = ALLOWED_ORIGINS.find(o => o.includes('localhost'));
          origin = localhost || ALLOWED_ORIGINS[0] || 'http://localhost:4321';
          if (isDev) console.log('[create-checkout] ⚠️ Origin no válido, usando fallback desarrollo:', origin);
        } else {
          console.error('[create-checkout] No hay dominio de producción en ALLOWED_ORIGINS. Rechazando solicitud.');
          return new Response(
            JSON.stringify({ error: 'Origen de solicitud inválido' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } else {
        origin = prodOrigin;
      }
    }
    
    if (isDev) console.log('[create-checkout] origin:', origin);

    const successUrl = `${origin}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/pago`;
    
    if (isDev) {
      console.log('[create-checkout] success_url:', successUrl);
      console.log('[create-checkout] cancel_url:', cancelUrl);
    }

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
        // Nota: Cada producto ya tiene talla en line_items[].price.metadata.talla
        // No guardamos carrito_json aquí porque Stripe limita metadata a 500 chars
      },
    };

    // Agregar descuento si existe
    if (couponId) {
      sessionConfig.discounts = [{ coupon: couponId }];
    }

    if (isDev) {
      console.log('[create-checkout] Creando sesión - items:', lineItems.length, 'coupon:', !!couponId);
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    if (isDev) console.log('[create-checkout] ✅ Sesión creada:', session.id);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[create-checkout] ❌ Error:', error.message);
    if (isDev) console.error('[create-checkout] Full error:', error);
    return new Response(
      JSON.stringify({ error: isDev ? error.message : 'Error al procesar el pago. Inténtalo de nuevo.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
