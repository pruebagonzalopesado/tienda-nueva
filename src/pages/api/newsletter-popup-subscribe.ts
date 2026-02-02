import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { sendEmail } from '../../lib/brevo';

interface SubscribeRequest {
  email: string;
  nombre?: string;
}

export const POST: APIRoute = async (context) => {
  try {
    const body = (await context.request.json()) as SubscribeRequest;
    const { email, nombre } = body;

    if (!email) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Email requerido'
        }),
        { status: 400 }
      );
    }

    // PASO 1: Verificar si ya está suscrito
    const { data: existente } = await supabase
      .from('newsletter_subscribers')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existente) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Ya estás suscrito a nuestra newsletter',
          alreadySubscribed: true
        }),
        { status: 200 }
      );
    }

    // PASO 2: Suscribir a newsletter
    const { error: subscribeError } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email,
        status: 'activo'
      });

    if (subscribeError) {
      console.error('[newsletter-popup] Error subscribing:', subscribeError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error al suscribirse'
        }),
        { status: 500 }
      );
    }

    // PASO 3: Generar código de descuento único (10%)
    const codigoDescuento = `BIENVENIDA-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    
    const { error: descuentoError } = await supabase
      .from('descuentos')
      .insert({
        codigo: codigoDescuento,
        porcentaje: 10,
        usos_maximos: 1,
        usos_actuales: 0,
        activo: true,
        descripcion: `Bienvenida Newsletter - ${email}`,
        fecha_inicio: new Date().toISOString()
      });

    if (descuentoError) {
      console.error('[newsletter-popup] Error creating discount:', descuentoError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error al crear el código de descuento'
        }),
        { status: 500 }
      );
    }

    console.log('[newsletter-popup] ✅ Código creado:', codigoDescuento);

    // PASO 4: Enviar email con código de descuento
    const emailContent = `
      <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #d4af37 0%, #b8941a 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Bienvenido a Joyería Galiana</h1>
        </div>
        
        <div style="background: white; padding: 40px; border: 1px solid #f0f0f0; border-radius: 0 0 12px 12px;">
          <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
            Gracias por suscribirte a nuestra newsletter. Nos alegra contar con vos como parte de nuestra comunidad de amantes de las joyas exclusivas.
          </p>

          <div style="background: #f9f9f9; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
            <p style="color: #999; font-size: 12px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px;">Tu código de descuento</p>
            <div style="background: white; padding: 20px; border-radius: 8px; border: 2px solid #d4af37; margin-bottom: 16px;">
              <span style="font-size: 32px; font-weight: 700; color: #d4af37; letter-spacing: 3px; font-family: monospace;">
                ${codigoDescuento}
              </span>
            </div>
            <p style="color: #666; font-size: 14px; margin: 0;">
              Descuento exclusivo del <strong>10%</strong> en tu primera compra
            </p>
          </div>

          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #d4af37;">
            <p style="color: #666; font-size: 13px; margin: 0;">
              <strong>Cómo usar tu código:</strong><br>
              1. Explora nuestra colección de joyas exclusivas<br>
              2. Agrega tus favoritas al carrito<br>
              3. Ingresa el código ${codigoDescuento} en el checkout<br>
              4. Disfruta tu descuento del 10%
            </p>
          </div>

          <p style="color: #666; margin: 24px 0; line-height: 1.6;">
            Este código es de un solo uso y válido para tu primera compra. Descubre nuestra exclusiva colección de anillos, collares y pendientes artesanales.
          </p>

          <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
            Nos encantaría mantente actualizado sobre nuestras novedades, colecciones especiales y ofertas exclusivas.
          </p>
          
          <p style="color: #333; margin-bottom: 24px; line-height: 1.8;">
            <a href="https://joyeriagaliana.com/productos" style="color: #d4af37; text-decoration: none; font-weight: 600;">Ir a la Colección</a><br>
            📧 <a href="mailto:info@joyeriagaliana.com" style="color: #d4af37; text-decoration: none;">info@joyeriagaliana.com</a><br>
            🌐 <a href="https://joyeriagaliana.com" style="color: #d4af37; text-decoration: none;">www.joyeriagaliana.com</a>
          </p>

          <p style="color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0; text-align: center;">
            Joyería Galiana<br>
            Sanlúcar de Barrameda, España<br>
            <em>Luxuria, elegancia y exclusividad</em>
          </p>
        </div>
      </div>
    `;

    const emailResult = await sendEmail({
      to: [{ email, name: nombre || 'Suscriptor' }],
      subject: `Bienvenido a Joyería Galiana - Tu Código de Descuento 10%`,
      htmlContent: emailContent
    });

    if (!emailResult.success) {
      console.error('[newsletter-popup] Error sending email:', emailResult.error);
    }

    console.log('[newsletter-popup] ✅ Suscripción exitosa, código:', codigoDescuento);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Te has suscrito exitosamente',
        codigoDescuento: codigoDescuento,
        descuento: 10
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('[newsletter-popup] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error al procesar la suscripción'
      }),
      { status: 500 }
    );
  }
};
