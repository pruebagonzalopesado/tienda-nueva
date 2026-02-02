import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { sendEmail } from '../../../lib/brevo';
import Stripe from 'stripe';
import { generateRefundInvoicePDF, obtenerDatosProducto } from '../../../lib/invoice-generator';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

interface ManageReturnRequest {
  devolucionId: number;
  action: 'listar' | 'confirmar' | 'rechazar';
  motivo_rechazo?: string;
}

export const POST: APIRoute = async (context) => {
  try {
    const body = (await context.request.json()) as ManageReturnRequest;
    const { devolucionId, action, motivo_rechazo } = body;

    // Validar que sea admin (en un proyecto real, verificarías el token JWT)
    // Por ahora asumimos que si llega a este endpoint, es admin

    if (action === 'listar') {
      // Listar todas las devoluciones pendientes
      const { data: devoluciones, error } = await supabase
        .from('devoluciones')
        .select(`
          *,
          pedidos:pedido_id(*)
        `)
        .in('estado', ['procesado', 'confirmada', 'rechazada'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[manage-returns] Error fetching devoluciones:', error);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Error al obtener devoluciones'
          }),
          { status: 500 }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          devoluciones
        }),
        { status: 200 }
      );
    }

    if (action === 'confirmar') {
      if (!devolucionId) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'ID de devolución requerido'
          }),
          { status: 400 }
        );
      }

      // Obtener la devolución
      const { data: devolucion, error: fetchError } = await supabase
        .from('devoluciones')
        .select(`
          *,
          pedidos:pedido_id(*)
        `)
        .eq('id', devolucionId)
        .single();

      if (fetchError || !devolucion) {
        console.error('[manage-returns] Error fetching devolucion:', fetchError);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Devolución no encontrada'
          }),
          { status: 404 }
        );
      }

      const pedido = devolucion.pedidos;

      // PASO 1: Generar PDF de factura de devolución confirmada
      let pdfBuffer: Buffer | undefined;
      try {
        const items = typeof pedido.items === 'string' 
          ? JSON.parse(pedido.items) 
          : (pedido.items || []);

        const productosConDetalles: any[] = [];
        for (const item of items) {
          const detalles = await obtenerDatosProducto(item.product_id || item.id);
          productosConDetalles.push({
            id: item.product_id || item.id,
            nombre: item.nombre || detalles?.nombre || 'Producto',
            cantidad: item.cantidad || 1,
            precio_unitario: item.precio || 0,
            subtotal: item.subtotal || (item.precio * item.cantidad),
            talla: item.talla
          });
        }

        const datosFacturaDevolucion = {
          numero_pedido: `DEV-${devolucion.pedido_id}`,
          fecha: new Date(),
          cliente: {
            nombre: devolucion.usuario_nombre || 'Cliente',
            email: devolucion.usuario_email,
            telefono: pedido?.telefono || 'No proporcionado',
            direccion: pedido?.direccion || 'No proporcionada',
            ciudad: pedido?.ciudad || 'No proporcionada',
            codigo_postal: pedido?.codigo_postal || 'No proporcionado',
            pais: pedido?.pais || 'ES'
          },
          productos: productosConDetalles,
          subtotal: pedido?.subtotal || 0,
          envio: pedido?.envio || 0,
          descuento: pedido?.descuento || 0,
          total: pedido?.total || 0
        };

        pdfBuffer = await generateRefundInvoicePDF(datosFacturaDevolucion);
        console.log('[manage-returns] ✅ Factura de devolución generada');
      } catch (pdfError) {
        console.warn('[manage-returns] ⚠️ Error generando factura de devolución:', pdfError);
      }

      // PASO 1-B: Procesar reembolso en Stripe
      let refundProcessed = false;
      try {
        if (pedido && pedido.stripe_payment_id) {
          const sessionId = pedido.stripe_payment_id;
          console.log('[manage-returns] Checkout Session ID:', sessionId);

          try {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            const paymentIntentId = session.payment_intent as string;

            console.log('[manage-returns] Payment Intent obtenido:', paymentIntentId);

            if (paymentIntentId) {
              const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                reason: 'requested_by_customer'
              });

              if (refund.id) {
                console.log('[manage-returns] ✅ Reembolso procesado:', refund.id);
                refundProcessed = true;
              }
            }
          } catch (refundError: any) {
            console.error('[manage-returns] Error procesando refund:', refundError.message);
          }
        }
      } catch (refundError) {
        console.warn('[manage-returns] ⚠️ Error al procesar reembolso de Stripe:', refundError);
      }

      // PASO 2: Actualizar estado de devolución a 'confirmada'
      const { error: updateError } = await supabase
        .from('devoluciones')
        .update({
          estado: 'confirmada',
          updated_at: new Date().toISOString()
        })
        .eq('id', devolucionId);

      if (updateError) {
        console.error('[manage-returns] Error updating devolucion:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Error al actualizar devolución'
          }),
          { status: 500 }
        );
      }

      // PASO 3: Enviar email "Devolución Confirmada y Reembolso en Proceso"
      const emailContent = `
        <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✅ Devolución Confirmada</h1>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #f0f0f0; border-radius: 0 0 12px 12px;">
            <p style="color: #666; margin-bottom: 24px;">Hola <strong>${devolucion.usuario_nombre}</strong>,</p>
            
            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
              Tu devolución para el pedido <strong>#${devolucion.pedido_id}</strong> ha sido <strong>confirmada</strong>.
            </p>

            <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #155724; margin: 0; font-size: 14px;">
                <strong>✅ Reembolso en Proceso:</strong> Hemos iniciado el proceso de reembolso. El dinero aparecerá en tu cuenta en 5-10 días hábiles dependiendo de tu banco.
              </p>
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 24px 0;">
              <h3 style="color: #333; margin-top: 0; font-size: 16px;">Detalles de la devolución:</h3>
              <p style="color: #666; margin: 8px 0;"><strong>Pedido:</strong> #${devolucion.pedido_id}</p>
              <p style="color: #666; margin: 8px 0;"><strong>Motivo:</strong> ${devolucion.motivo_solicitud}</p>
              <p style="color: #666; margin: 8px 0;"><strong>Estado:</strong> Confirmada</p>
              <p style="color: #666; margin: 8px 0;"><strong>Monto a reembolsar:</strong> €${pedido?.total || 'N/A'}</p>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>📎 Adjunto:</strong> Encontrarás la nota de referencia de tu devolución.
              </p>
            </div>

            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
              Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos:
            </p>
            
            <p style="color: #333; margin-bottom: 24px; line-height: 1.8;">
              📧 <a href="mailto:info@joyeriagaliana.com" style="color: #28a745; text-decoration: none;">info@joyeriagaliana.com</a><br>
              🌐 <a href="https://joyeriagaliana.com" style="color: #28a745; text-decoration: none;">www.joyeriagaliana.com</a>
            </p>

            <p style="color: #999; font-size: 13px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
              Joyería Galiana<br>
              Sanlúcar de Barrameda, España<br>
              <em>Gracias por tu confianza</em>
            </p>
          </div>
        </div>
      `;

      const emailResult = await sendEmail({
        to: [{ email: devolucion.usuario_email, name: devolucion.usuario_nombre }],
        subject: `Devolución Confirmada y Reembolso en Proceso - Pedido #${devolucion.pedido_id} - Joyería Galiana`,
        htmlContent: emailContent,
        attachment: pdfBuffer ? {
          content: pdfBuffer.toString('base64'),
          name: `nota_devolucion_${devolucion.pedido_id}.pdf`
        } : undefined
      });

      if (!emailResult.success) {
        console.error('[manage-returns] Error sending email:', emailResult.error);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Devolución confirmada y reembolso procesado',
          refundProcessed: refundProcessed
        }),
        { status: 200 }
      );
    }

    if (action === 'rechazar') {
      if (!devolucionId) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'ID de devolución requerido'
          }),
          { status: 400 }
        );
      }

      if (!motivo_rechazo || motivo_rechazo.trim().length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Motivo de rechazo requerido'
          }),
          { status: 400 }
        );
      }

      // Obtener la devolución
      const { data: devolucion, error: fetchError } = await supabase
        .from('devoluciones')
        .select('*')
        .eq('id', devolucionId)
        .single();

      if (fetchError || !devolucion) {
        console.error('[manage-returns] Error fetching devolucion:', fetchError);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Devolución no encontrada'
          }),
          { status: 404 }
        );
      }

      // Actualizar estado de devolución a 'rechazada' con motivo
      const { error: updateError } = await supabase
        .from('devoluciones')
        .update({
          estado: 'rechazada',
          motivo_rechazo: motivo_rechazo,
          updated_at: new Date().toISOString()
        })
        .eq('id', devolucionId);

      if (updateError) {
        console.error('[manage-returns] Error updating devolucion:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Error al actualizar devolución'
          }),
          { status: 500 }
        );
      }

      // Enviar email "Devolución Rechazada"
      const emailContent = `
        <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f44336 0%, #e91e63 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">❌ Devolución Rechazada</h1>
          </div>
          
          <div style="background: white; padding: 40px; border: 1px solid #f0f0f0; border-radius: 0 0 12px 12px;">
            <p style="color: #666; margin-bottom: 24px;">Hola <strong>${devolucion.usuario_nombre}</strong>,</p>
            
            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
              Lamentablemente, tu solicitud de devolución para el pedido <strong>#${devolucion.pedido_id}</strong> ha sido <strong>rechazada</strong>.
            </p>

            <div style="background: #ffebee; border-left: 4px solid #f44336; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #c62828; margin: 0; font-size: 14px; font-weight: bold;">
                Motivo del rechazo:
              </p>
              <p style="color: #d32f2f; margin: 8px 0 0 0; font-size: 14px; line-height: 1.6;">
                ${motivo_rechazo}
              </p>
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 24px 0;">
              <h3 style="color: #333; margin-top: 0; font-size: 16px;">Detalles de tu solicitud:</h3>
              <p style="color: #666; margin: 8px 0;"><strong>Pedido:</strong> #${devolucion.pedido_id}</p>
              <p style="color: #666; margin: 8px 0;"><strong>Motivo solicitado:</strong> ${devolucion.motivo_solicitud}</p>
              <p style="color: #666; margin: 8px 0;"><strong>Estado:</strong> Rechazada</p>
            </div>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>¿Tienes preguntas?</strong> Si crees que se trata de un error o deseas obtener más información sobre esta decisión, no dudes en contactarnos. Revisaremos tu caso.
              </p>
            </div>

            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
              Estamos aquí para ayudarte. Contáctanos si necesitas más información:
            </p>
            
            <p style="color: #333; margin-bottom: 24px; line-height: 1.8;">
              📧 <a href="mailto:info@joyeriagaliana.com" style="color: #f44336; text-decoration: none;">info@joyeriagaliana.com</a><br>
              🌐 <a href="https://joyeriagaliana.com" style="color: #f44336; text-decoration: none;">www.joyeriagaliana.com</a>
            </p>

            <p style="color: #999; font-size: 13px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
              Joyería Galiana<br>
              Sanlúcar de Barrameda, España
            </p>
          </div>
        </div>
      `;

      const emailResult = await sendEmail({
        to: [{ email: devolucion.usuario_email, name: devolucion.usuario_nombre }],
        subject: `Devolución Rechazada - Pedido #${devolucion.pedido_id} - Joyería Galiana`,
        htmlContent: emailContent
      });

      if (!emailResult.success) {
        console.error('[manage-returns] Error sending email:', emailResult.error);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Devolución rechazada'
        }),
        { status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Acción no reconocida'
      }),
      { status: 400 }
    );

  } catch (error) {
    console.error('[manage-returns] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error interno del servidor'
      }),
      { status: 500 }
    );
  }
};
