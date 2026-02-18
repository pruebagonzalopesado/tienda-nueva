import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';
import { sendEmail } from '../../lib/brevo';
import { generateInvoicePDF, obtenerDatosProducto } from '../../lib/invoice-generator';
import { isDev, sanitizeForLog } from '../../lib/debug';

// Helpers de seguridad
const EMAIL_RE = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const POST: APIRoute = async ({ request }) => {
  try {
    const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
    
    if (!stripeKey) {
      console.error('[create-order] STRIPE_SECRET_KEY no encontrada');
      return new Response(
        JSON.stringify({ error: 'Servicio de pago no disponible' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey);

    // Obtener datos de la solicitud
    const data = await request.json();
    const {
      userId,
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

    if (isDev) {
      console.log('[create-order] >>> Creando orden');
      console.log('[create-order]     - Usuario ID: ' + (userId || 'null'));
      console.log('[create-order]     - Payment Intent ID: ' + sanitizeForLog(paymentIntentId || ''));
      console.log('[create-order]     - Email: ' + sanitizeForLog(email || ''));
      console.log('[create-order]     - Total: €' + total);
      console.log('[create-order]     - Items: ' + items?.length);
    }

    // Validar datos requeridos
    if (!nombre || !email || !direccion || !ciudad || !total) {
      console.error('[create-order] Datos incompletos');
      return new Response(
        JSON.stringify({ error: 'Datos incompletos requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato de email
    if (!EMAIL_RE.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Formato de email inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No hay productos en el pedido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insertar orden en Supabase
    const { data: pedido, error: dbError } = await supabase
      .from('pedidos')
      .insert([
        {
          usuario_id: userId || null,
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
        },
      ])
      .select('id');

    if (dbError) {
      console.error('[create-order] Error en DB:', dbError);
      return new Response(
        JSON.stringify({ error: 'Error al crear la orden. Por favor intenta de nuevo.' }),
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

    // ===== Generar PDF y enviar correo de confirmación =====
    let pdfBuffer: Buffer | null = null;

    try {
      console.log('[create-order] 🔄 Enriqueciendo datos de productos...');
      
      // Enriquecer items con datos de productos
      const productosEnriquecidos = [];
      for (const item of items) {
        console.log(`[create-order]   Obteniendo datos del producto: ${item.product_id}`);
        const datosProducto = await obtenerDatosProducto(item.product_id);
        
        if (datosProducto) {
          productosEnriquecidos.push({
            id: item.product_id,
            nombre: datosProducto.nombre || item.nombre,
            cantidad: item.cantidad,
            precio_unitario: datosProducto.precio || item.precio,
            subtotal: (datosProducto.precio || item.precio) * item.cantidad,
            talla: item.talla,
          });
        } else {
          // Usar datos del item si no se puede obtener el producto
          productosEnriquecidos.push({
            id: item.product_id,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
            subtotal: item.precio * item.cantidad,
            talla: item.talla,
          });
        }
      }

      console.log('[create-order] ✅ Datos de productos enriquecidos');

      // Crear objeto de datos para la factura
      const datosFactura = {
        numero_pedido: pedidoId.toString(),
        fecha: new Date(),
        cliente: {
          nombre,
          email,
          telefono: telefono || '',
          direccion,
          ciudad,
          codigo_postal: codigoPostal || '',
          pais: pais || 'España',
        },
        productos: productosEnriquecidos,
        subtotal,
        envio,
        descuento: 0,
        total,
      };

      console.log('[create-order] 📄 Generando PDF de factura...');
      pdfBuffer = await generateInvoicePDF(datosFactura);

      if (Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
        console.log(`[create-order] ✅ PDF generado exitosamente (${pdfBuffer.length} bytes)`);
      } else {
        console.warn('[create-order] ⚠️ PDF inválido, continuando sin adjunto');
        pdfBuffer = null;
      }
    } catch (pdfError) {
      console.error('[create-order] ⚠️ Error generando PDF:', pdfError);
      pdfBuffer = null;
    }

    // Construir HTML del email directamente
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
            .header { background: linear-gradient(135deg, #8b1538 0%, #6a0f2a 100%); color: white; padding: 40px 20px; text-align: center; }
            .header h1 { font-size: 28px; font-weight: 300; letter-spacing: 2px; margin-bottom: 10px; }
            .success-badge { display: inline-block; background: rgba(212, 175, 55, 0.3); padding: 8px 16px; border-radius: 20px; font-size: 12px; margin-top: 10px; color: #d4af37; }
            .content { padding: 40px 30px; background: #fafafa; }
            .greeting { font-size: 18px; color: #8b1538; margin-bottom: 20px; font-weight: 500; }
            .success-message { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; border-radius: 3px; margin-bottom: 30px; color: #2e7d32; }
            .success-message p { margin: 0; font-size: 14px; }
            .order-box { background: white; border: 1px solid #e0e0e0; border-radius: 5px; padding: 20px; margin: 20px 0; }
            .order-box h3 { color: #8b1538; font-size: 14px; margin-bottom: 15px; border-bottom: 2px solid #d4af37; padding-bottom: 10px; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { color: #666; font-weight: 500; }
            .detail-value { color: #333; font-weight: 600; }
            .total-box { background: #f5f5f5; padding: 12px; margin: 15px 0; border-radius: 3px; display: flex; justify-content: space-between; font-weight: bold; border-left: 4px solid #d4af37; }
            .total-box .amount { color: #8b1538; font-size: 18px; }
            .pdf-notice { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 3px; font-size: 13px; color: #856404; }
            .footer { background: #2c2c2c; color: #d4af37; padding: 30px; text-align: center; font-size: 12px; }
            .footer p { margin: 8px 0; }
            .logo-text { font-size: 24px; font-weight: 300; letter-spacing: 1px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>PEDIDO REALIZADO</h1>
              <div class="success-badge">✓ CONFIRMADO</div>
            </div>
            
            <div class="content">
              <div class="greeting">¡Gracias, ${nombre}!</div>
              
              <div class="success-message">
                <p>${pdfBuffer ? 'Tu pedido ha sido confirmado exitosamente. La factura detallada se adjunta a este email.' : 'Tu pedido ha sido confirmado exitosamente. Tu número de pedido se muestra abajo.'}</p>
              </div>
              
              <div class="order-box">
                <h3>DETALLES DEL PEDIDO</h3>
                <div class="detail-row">
                  <span class="detail-label">Número de Pedido:</span>
                  <span class="detail-value">#${pedidoId}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Fecha:</span>
                  <span class="detail-value">${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Estado:</span>
                  <span class="detail-value" style="color: #4caf50;">Confirmado</span>
                </div>
              </div>

              <div class="order-box">
                <h3>RESUMEN DE PAGO</h3>
                <div class="detail-row">
                  <span class="detail-label">Subtotal:</span>
                  <span class="detail-value">€ ${subtotal.toFixed(2)}</span>
                </div>
                ${envio && envio > 0 ? `
                <div class="detail-row">
                  <span class="detail-label">Envío:</span>
                  <span class="detail-value">€ ${envio.toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="total-box">
                  <span>TOTAL:</span>
                  <span class="amount">€ ${total.toFixed(2)}</span>
                </div>
              </div>

              ${pdfBuffer ? `
              <div class="pdf-notice">
                <strong>📎 Factura adjunta:</strong> Encontrarás la factura detallada en formato PDF adjunto a este email. Por favor descárgala y guárdala para tus registros.
              </div>
              ` : ''}

              <p style="font-size: 13px; color: #999; margin-top: 20px; text-align: center;">
                Gracias por tu confianza. En Joyería Galiana nos compromete ofrecerte<br>
                la mejor experiencia de compra con productos de lujo y calidad garantizada.
              </p>
            </div>
            
            <div class="footer">
              <div class="logo-text">JOYERÍA GALIANA</div>
              <p>Sanlúcar de Barrameda, España</p>
              <p style="margin-top: 15px; opacity: 0.7;">© 2026 Joyería Galiana. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enviar correo de confirmación con Brevo
    try {
      console.log('[create-order] 📧 Preparando email de confirmación para:', email);

      const brevoApiKey = import.meta.env.BREVO_API_KEY;
      const brevoFromEmail = import.meta.env.BREVO_FROM_EMAIL;
      const brevoFromName = import.meta.env.BREVO_FROM_NAME;

      if (!brevoApiKey || !brevoFromEmail) {
        console.warn('[create-order] ⚠️ Variables de Brevo no configuradas (BREVO_API_KEY o BREVO_FROM_EMAIL)');
      } else {
        const emailPayload: any = {
          sender: {
            name: brevoFromName || 'Joyería Galiana',
            email: brevoFromEmail,
          },
          to: [
            {
              email: email,
              name: nombre,
            },
          ],
          subject: `Pedido Realizado #${pedidoId}`,
          htmlContent: htmlContent,
        };

        // Agregar PDF si es válido
        if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
          console.log('[create-order] 📎 Adjuntando PDF a email...');
          const base64PDF = pdfBuffer.toString('base64');
          emailPayload.attachment = [
            {
              content: base64PDF,
              name: `factura_${pedidoId}.pdf`,
            },
          ];
          console.log('[create-order] ✅ PDF adjuntado correctamente');
        }

        console.log('[create-order] 🚀 Enviando email a Brevo...');
        const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': brevoApiKey,
          },
          body: JSON.stringify(emailPayload),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          console.error('[create-order] ❌ Error en Brevo API:', errorData);
          console.warn('[create-order] ⚠️ Email no enviado, pero orden creada exitosamente');
        } else {
          const result = await emailResponse.json();
          console.log('[create-order] ✅ Email enviado exitosamente (MessageId:', result.messageId, ')');
        }
      }
    } catch (emailError) {
      console.error('[create-order] ⚠️ Error enviando email:', emailError);
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
        },
      }
    );
  } catch (error: any) {
    console.error('[create-order] ❌ Error:', error.message);
    if (isDev) {
      console.error('[create-order] Stack:', error.stack);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error al procesar el pedido. Por favor intenta de nuevo.',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};