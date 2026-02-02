import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await request.json();
    const { pedidoId, estado } = data;

    if (!pedidoId || !estado) {
      return new Response(
        JSON.stringify({ error: 'ID de pedido y estado son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Estados válidos
    const estadosValidos = ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado'];
    if (!estadosValidos.includes(estado)) {
      return new Response(
        JSON.stringify({ error: 'Estado inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Actualizar el estado del pedido
    const { data: updatedOrder, error } = await supabase
      .from('pedidos')
      .update({ estado })
      .eq('id', pedidoId)
      .select();

    if (error) {
      console.error('Error al actualizar pedido:', error);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar el pedido' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Si el estado es "enviado", enviar email al comprador
    if (estado === 'enviado' && updatedOrder && updatedOrder.length > 0) {
      const pedido = updatedOrder[0];
      const brevoKey = import.meta.env.BREVO_API_KEY;
      
      console.log('🔍 Verificando envío de email:');
      console.log('   - Estado es enviado:', estado === 'enviado');
      console.log('   - Pedido existe:', !!pedido);
      console.log('   - Email del cliente:', pedido.email);
      console.log('   - Brevo API Key configurada:', !!brevoKey);
      
      if (!brevoKey) {
        console.error('❌ BREVO_API_KEY no está configurada en las variables de entorno');
      }
      
      if (brevoKey && pedido.email) {
        try {
          console.log('📧 Preparando envío de email a:', pedido.email);
          
          const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'api-key': brevoKey
            },
            body: JSON.stringify({
              to: [{ email: pedido.email, name: pedido.nombre || 'Cliente' }],
              sender: { name: 'Joyería Galiana', email: 'reportsanlucar@gmail.com' },
              subject: '¡Tu pedido ha sido enviado!',
              htmlContent: `
                <html>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
                      <h2 style="color: #8b5a3c; text-align: center;">¡Tu Pedido Ha Sido Enviado!</h2>
                      
                    <p style="font-size: 16px;">Hola ${pedido.nombre || 'Cliente'},</p>
                      
                      <div style="background-color: #fff; padding: 15px; border-left: 4px solid #d4af37; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Número de Pedido:</strong> ${pedido.id}</p>
                        <p style="margin: 5px 0;"><strong>Total:</strong> €${pedido.total.toFixed(2)}</p>
                        <p style="margin: 5px 0;"><strong>Dirección de Envío:</strong><br>${pedido.direccion}, ${pedido.ciudad} ${pedido.codigo_postal}, ${pedido.pais}</p>
                        <p style="margin: 5px 0;"><strong>Número de Seguimiento:</strong> SEUR${Date.now().toString().slice(-8)}</p>
                      </div>
                      
                      <p>El paquete está en camino y pronto estará en tus manos. Puedes seguir el estado de tu pedido en nuestra plataforma.</p>
                      
                      <p style="text-align: center; margin: 20px 0;">
                        <a href="https://www.seur.com/miseur/mis-envios" style="background-color: #d4af37; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Sigue tu Envío</a>
                      </p>
                      
                      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                      
                      <p style="font-size: 12px; color: #666; text-align: center;">
                        Si tienes preguntas, no dudes en contactarnos en <strong>reportsanlucar@gmail.com</strong>
                      </p>
                      
                      <p style="font-size: 12px; color: #999; text-align: center; margin-top: 10px;">
                        © 2026 Joyería Galiana. Todos los derechos reservados.
                      </p>
                    </div>
                  </body>
                </html>
              `
            })
          });
          
          const responseText = await emailResponse.text();
          console.log('📡 Response status:', emailResponse.status);
          console.log('📡 Response body:', responseText);
          
          if (emailResponse.ok) {
            console.log('✅ Email de paquete enviado correctamente');
          } else {
            console.error('❌ Error al enviar email. Status:', emailResponse.status);
            console.error('❌ Respuesta:', responseText);
          }
        } catch (emailError) {
          console.error('❌ Error en try-catch enviando email:', emailError);
        }
      } else {
        console.warn('⚠️ No se envió email: brevoKey=', !!brevoKey, 'email=', pedido?.email);
      }
    }

    return new Response(
      JSON.stringify({ success: true, pedido: updatedOrder[0] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en update-pedido-estado:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
