import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendPaymentSuccessEmail } from '../../lib/brevo';

export const POST: APIRoute = async ({ request }) => {
  try {
    const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
    
    if (!stripeKey) {
      console.error('[create-order] STRIPE_SECRET_KEY no encontrada');
      return new Response(
        JSON.stringify({ error: 'Stripe no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[create-order] Supabase no configurado');
      return new Response(
        JSON.stringify({ error: 'Supabase no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Obtener datos de la solicitud
    const data = await request.json();
    const {
      paymentIntentId,
      nombre,
      email,
      telefono,
      direccion,
      ciudad,
      codigoPostal,
      pais,
      subtotal,
      envio,
      total,
      items,
    } = data;

    console.log('[create-order] >>> Creando orden');
    console.log('[create-order]     - Nombre: ' + nombre);
    console.log('[create-order]     - Email: ' + email);
    console.log('[create-order]     - Total: €' + total);
    console.log('[create-order]     - Items: ' + items.length);

    // Validar datos requeridos
    if (!nombre || !email || !direccion || !ciudad || !total) {
      console.error('[create-order] Datos incompletos');
      return new Response(
        JSON.stringify({ error: 'Datos incompletos requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insertar orden en Supabase
    const { data: pedido, error: dbError } = await supabase
      .from('pedidos')
      .insert([
        {
          nombre,
          email,
          telefono: telefono || '',
          direccion,
          ciudad,
          codigo_postal: codigoPostal || '',
          pais: pais || 'España',
          subtotal,
          envio,
          total,
          items: items,
          stripe_payment_id: paymentIntentId,
          estado: 'confirmado',
          usuario_id: null, // Puedes agregar autenticación si lo deseas
        },
      ])
      .select('id');

    if (dbError) {
      console.error('[create-order] Error en DB:', dbError);
      return new Response(
        JSON.stringify({ error: 'Error al crear la orden: ' + dbError.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!pedido || pedido.length === 0) {
      console.error('[create-order] No se creó la orden');
      return new Response(
        JSON.stringify({ error: 'No se pudo crear la orden' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pedidoId = pedido[0].id;
    console.log('[create-order] ✅ Orden creada:', pedidoId);

    // Enviar correo de confirmación con Brevo
    try {
      console.log('[create-order] 📧 Enviando correo de confirmación a:', email);
      const emailResult = await sendPaymentSuccessEmail(
        email,
        nombre,
        pedidoId,
        total,
        undefined, // pdfBuffer opcional
        {
          subtotal,
          envio,
        }
      );
      
      if (emailResult.success) {
        console.log('[create-order] ✅ Correo enviado exitosamente');
      } else {
        console.warn('[create-order] ⚠️ Error enviando correo:', emailResult.error);
        // No interrumpir el flujo si falla el email
      }
    } catch (emailError) {
      console.error('[create-order] ⚠️ Error enviando correo:', emailError);
      // No interrumpir el flujo si falla el email
    }

    return new Response(
      JSON.stringify({
        success: true,
        pedidoId: pedidoId,
        message: 'Orden creada exitosamente',
        correoEnviado: true,
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('[create-order] ❌ Error:', error.message);
    console.error('[create-order] Stack:', error.stack);

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
        },
      }
    );
  }
};
