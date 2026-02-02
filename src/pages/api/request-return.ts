import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { sendEmail } from '../../lib/brevo';
import { generateRefundInvoicePDF, obtenerDatosProducto } from '../../lib/invoice-generator';

interface ReturnRequest {
  pedidoId: number | string;
  email: string;
  nombre: string;
  motivo: string;
}

export const POST: APIRoute = async (context) => {
  try {
    const body = (await context.request.json()) as ReturnRequest;
    const { pedidoId, email, nombre, motivo } = body;

    // Validar entrada
    if (!pedidoId || !email || !nombre || !motivo) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Faltan parámetros requeridos'
        }),
        { status: 400 }
      );
    }

    if (motivo.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'El motivo debe tener al menos 10 caracteres'
        }),
        { status: 400 }
      );
    }

    // PASO 1: Actualizar estado del pedido a "devolucion_proceso"
    const { error: updatePedidoError } = await supabase
      .from('pedidos')
      .update({
        estado: 'devolucion_proceso'
      })
      .eq('id', parseInt(String(pedidoId)));

    if (updatePedidoError) {
      console.error('[request-return] Error updating pedido status:', updatePedidoError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error al procesar la solicitud'
        }),
        { status: 500 }
      );
    }

    // PASO 2: Crear registro en tabla de devoluciones con estado "procesado"
    const { data: devolucion, error: insertDevError } = await supabase
      .from('devoluciones')
      .insert({
        pedido_id: parseInt(String(pedidoId)),
        usuario_email: email,
        usuario_nombre: nombre,
        motivo_solicitud: motivo,
        estado: 'procesado'
      })
      .select()
      .single();

    if (insertDevError) {
      console.error('[request-return] Error creating devolucion record:', insertDevError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error al registrar la devolución'
        }),
        { status: 500 }
      );
    }

    console.log('[request-return] ✅ Devolución registrada con ID:', devolucion?.id);

    // PASO 3: Obtener datos del pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();

    if (pedidoError || !pedido) {
      console.error('[request-return] Error fetching order:', pedidoError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Pedido no encontrado'
        }),
        { status: 404 }
      );
    }

    // PASO 4: Generar factura de devolución (PDF)
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
        numero_pedido: `DEV-${pedidoId}`,
        fecha: new Date(),
        cliente: {
          nombre: pedido.nombre_cliente || nombre || 'Cliente',
          email: email,
          telefono: pedido.telefono || 'No proporcionado',
          direccion: pedido.direccion || 'No proporcionada',
          ciudad: pedido.ciudad || 'No proporcionada',
          codigo_postal: pedido.codigo_postal || 'No proporcionado',
          pais: pedido.pais || 'ES'
        },
        productos: productosConDetalles,
        subtotal: pedido.subtotal || 0,
        envio: pedido.envio || 0,
        descuento: pedido.descuento || 0,
        total: pedido.total || 0
      };

      pdfBuffer = await generateRefundInvoicePDF(datosFacturaDevolucion);
      console.log('[request-return] ✅ Factura de devolución generada');
    } catch (pdfError) {
      console.warn('[request-request] ⚠️ Error generando factura de devolución:', pdfError);
    }

    // PASO 5: Enviar email "Devolución en Proceso" al cliente
    const emailContent = `
      <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #d4af37 0%, #b8941a 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">📋 Devolución en Proceso</h1>
        </div>
        
        <div style="background: white; padding: 40px; border: 1px solid #f0f0f0; border-radius: 0 0 12px 12px;">
          <p style="color: #666; margin-bottom: 24px;">Hola <strong>${nombre}</strong>,</p>
          
          <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
            Tu solicitud de devolución para el pedido <strong>#${pedidoId}</strong> ha sido registrada exitosamente.
          </p>

          <div style="background: #f9f9f9; padding: 16px; border-left: 4px solid #d4af37; margin: 24px 0; border-radius: 4px;">
            <p style="color: #333; margin: 0; font-weight: bold; margin-bottom: 8px;">Motivo de devolución:</p>
            <p style="color: #666; margin: 0; line-height: 1.6;">"${motivo}"</p>
          </div>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>⏳ Estado:</strong> Tu solicitud está siendo procesada. Nos pondremos en contacto dentro de 24 horas con los pasos a seguir.
            </p>
          </div>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 24px 0;">
            <h3 style="color: #333; margin-top: 0; font-size: 16px;">¿Qué sucede ahora?</h3>
            <ol style="color: #666; line-height: 1.8;">
              <li><strong>Revisión:</strong> Nuestro equipo revisará tu solicitud en las próximas 24 horas.</li>
              <li><strong>Contacto:</strong> Te enviaremos las instrucciones de envío y una etiqueta prepagada.</li>
              <li><strong>Envío:</strong> Empaca el artículo y envíalo siguiendo las instrucciones proporcionadas.</li>
              <li><strong>Inspección:</strong> Verificaremos el estado del artículo al recibirlo (5 días hábiles).</li>
              <li><strong>Reembolso:</strong> Una vez aprobada la devolución, procesaremos tu reembolso (hasta 10 días hábiles).</li>
            </ol>
          </div>


          <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
            Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos:
          </p>
          
          <p style="color: #333; margin-bottom: 24px; line-height: 1.8;">
            📧 <a href="mailto:info@joyeriagaliana.com" style="color: #d4af37; text-decoration: none;">info@joyeriagaliana.com</a><br>
            🌐 <a href="https://joyeriagaliana.com" style="color: #d4af37; text-decoration: none;">www.joyeriagaliana.com</a>
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
      to: [{ email, name: nombre }],
      subject: `Devolución en Proceso - Pedido #${pedidoId} - Joyería Galiana`,
      htmlContent: emailContent
    });

    if (!emailResult.success) {
      console.error('[request-return] Error sending email:', emailResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Se registró la devolución pero hubo un error al enviar el email'
        }),
        { status: 500 }
      );
    }

    console.log('[request-return] ✅ Email "Devolución en Proceso" enviado correctamente');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Solicitud de devolución procesada correctamente. Te hemos enviado un email con la información.',
        devolucionId: devolucion?.id
      }),
      { status: 200 }
    );

  } catch (error) {
    console.error('[request-return] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error interno del servidor'
      }),
      { status: 500 }
    );
  }
};
