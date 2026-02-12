import { supabase } from '../../lib/supabase';
import { sendEmail } from '../../lib/brevo';
import { generateRefundInvoicePDF, obtenerDatosProducto } from '../../lib/invoice-generator';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);

export const POST = async ({ request }: any) => {
    try {
        const { pedidoId, email, nombre } = await request.json();

        console.log('[cancel-order] Recibiendo solicitud de cancelación');
        console.log(`[cancel-order] Pedido ID: ${pedidoId}, Email: ${email}`);
        
        if (!email) {
            console.warn('[cancel-order] Email no proporcionado');
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    message: 'Email no proporcionado' 
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Obtener los items del pedido primero
        const { data: pedido, error: fetchError } = await supabase
            .from('pedidos')
            .select('items')
            .eq('id', pedidoId)
            .single();

        if (fetchError || !pedido) {
            console.error('[cancel-order] Error al obtener pedido:', fetchError);
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    message: 'No se pudo obtener los datos del pedido' 
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Restaurar stock de cada producto
        try {
            let items = [];
            if (pedido.items) {
                items = typeof pedido.items === 'string' ? JSON.parse(pedido.items) : pedido.items;
            }

            console.log('[cancel-order] Restaurando stock para', items.length, 'productos');

            for (const item of items) {
                if (item.product_id) {
                    // Obtener el stock actual
                    const { data: productData, error: getError } = await supabase
                        .from('products')
                        .select('stock, id')
                        .eq('id', item.product_id)
                        .single();

                    if (!getError && productData) {
                        const nuevoStock = (productData.stock || 0) + (item.cantidad || 1);
                        
                        // Actualizar stock
                        const { error: updateStockError } = await supabase
                            .from('products')
                            .update({ stock: nuevoStock })
                            .eq('id', item.product_id);

                        if (!updateStockError) {
                            console.log(`[cancel-order] Stock restaurado para producto ${item.product_id}: +${item.cantidad}`);
                        } else {
                            console.warn(`[cancel-order] Error al restaurar stock para producto ${item.product_id}:`, updateStockError);
                        }
                    }
                }
            }
        } catch (stockError) {
            console.error('[cancel-order] Error al procesar restauración de stock:', stockError);
        }

        // Actualizar estado del pedido a cancelado
        const { error: updateError } = await supabase
            .from('pedidos')
            .update({ estado: 'cancelado' })
            .eq('id', pedidoId);

        if (updateError) {
            console.error('[cancel-order] Error al actualizar pedido:', updateError);
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    message: 'No se pudo actualizar el estado del pedido' 
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        console.log('[cancel-order] Pedido actualizado a cancelado');

        // ===== PROCESAR REEMBOLSO CON STRIPE =====
        let refundProcessed = false;
        try {
            // Obtener datos completos del pedido para el reembolso
            const { data: pedidoCompleto } = await supabase
                .from('pedidos')
                .select('*')
                .eq('id', pedidoId)
                .single();

            if (pedidoCompleto && pedidoCompleto.stripe_payment_id) {
                const stripeId = pedidoCompleto.stripe_payment_id;
                console.log('[cancel-order] Stripe Payment ID:', stripeId);
                
                try {
                    let paymentIntentId = stripeId;

                    // Si es una sesión (comienza con cs_), obtener el Payment Intent
                    if (stripeId.startsWith('cs_')) {
                        console.log('[cancel-order] ID es una sesión, obteniendo Payment Intent...');
                        const session = await stripe.checkout.sessions.retrieve(stripeId);
                        paymentIntentId = session.payment_intent as string;
                        console.log('[cancel-order] Payment Intent obtenido:', paymentIntentId);
                    } else if (stripeId.startsWith('pi_')) {
                        console.log('[cancel-order] ID es un Payment Intent, usando directamente');
                    }

                    if (paymentIntentId) {
                        // Procesar el refund
                        console.log('[cancel-order] Creando refund para Payment Intent:', paymentIntentId);
                        const refund = await stripe.refunds.create({
                            payment_intent: paymentIntentId,
                            reason: 'requested_by_customer'
                        });

                        if (refund && refund.id) {
                            console.log('[cancel-order] ✅ Reembolso procesado exitosamente:', refund.id);
                            console.log('[cancel-order]     - Status:', refund.status);
                            console.log('[cancel-order]     - Monto:', refund.amount);
                            refundProcessed = true;
                        }
                    }
                } catch (refundError: any) {
                    console.error('[cancel-order] ❌ Error procesando refund:', refundError.message);
                    if (refundError.raw) {
                        console.error('[cancel-order] Detalles:', refundError.raw.message);
                    }
                }
            } else {
                console.warn('[cancel-order] ⚠️ No se encontró stripe_payment_id en el pedido');
            }
        } catch (refundError) {
            console.error('[cancel-order] ❌ Error al procesar reembolso de Stripe:', refundError);
        }

        // ===== GENERAR FACTURA DE DEVOLUCIÓN =====
        let pdfBuffer: Buffer | undefined;
        let pedidoCompleto: any;
        try {
            // Obtener datos completos del pedido
            const response = await supabase
                .from('pedidos')
                .select('*')
                .eq('id', pedidoId)
                .single();
            
            pedidoCompleto = response.data;

            if (pedidoCompleto) {
                const items = typeof pedidoCompleto.items === 'string' 
                    ? JSON.parse(pedidoCompleto.items) 
                    : (pedidoCompleto.items || []);

                // Enriquecer productos con detalles
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
                        nombre: pedidoCompleto.nombre_cliente || nombre || 'Cliente',
                        email: email,
                        telefono: pedidoCompleto.telefono || 'No proporcionado',
                        direccion: pedidoCompleto.direccion || 'No proporcionada',
                        ciudad: pedidoCompleto.ciudad || 'No proporcionada',
                        codigo_postal: pedidoCompleto.codigo_postal || 'No proporcionado',
                        pais: pedidoCompleto.pais || 'ES'
                    },
                    productos: productosConDetalles,
                    subtotal: pedidoCompleto.subtotal || 0,
                    envio: pedidoCompleto.envio || 0,
                    descuento: pedidoCompleto.descuento || 0,
                    total: pedidoCompleto.total || 0
                };

                pdfBuffer = await generateRefundInvoicePDF(datosFacturaDevolucion);
                console.log('[cancel-order] ✅ Factura de devolución generada');
            }
        } catch (pdfError) {
            console.warn('[cancel-order] ⚠️ Error generando factura de devolución:', pdfError);
        }

        console.log('[cancel-order] Pedido actualizado a cancelado');

        // ===== ENVIAR EMAIL FINAL CON FACTURA DE CANCELACIÓN =====
        try {
            console.log('[cancel-order] 📧 Enviando email de confirmación de cancelación a:', email);
            
            const emailResult = await sendEmail({
                to: [{ email: email, name: nombre }],
                subject: `Pedido Cancelado${refundProcessed ? ' - Reembolso Procesado' : ''} - Pedido #${pedidoId} - Joyería Galiana`,
                htmlContent: `
                    <div style="font-family: 'Playfair Display', Georgia, serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">✅ Pedido Cancelado</h1>
                        </div>
                        
                        <div style="background: white; padding: 40px; border: 1px solid #f0f0f0; border-radius: 0 0 12px 12px;">
                            <p style="color: #666; margin-bottom: 24px;">
                                Hola <strong>${nombre}</strong>,
                            </p>
                            
                            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
                                Tu pedido <strong>#${pedidoId}</strong> ha sido cancelado.
                            </p>

                            ${refundProcessed ? `
                            <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 16px; margin: 24px 0; border-radius: 4px;">
                                <p style="color: #155724; margin: 0; font-size: 14px;">
                                    <strong>✅ Reembolso Iniciado:</strong> Tu reembolso ha sido iniciado en Stripe y aparecerá en tu cuenta en 5-10 días hábiles.
                                </p>
                            </div>
                            ` : `
                            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 24px 0; border-radius: 4px;">
                                <p style="color: #856404; margin: 0; font-size: 14px;">
                                    <strong>⚠️ Reembolso Pendiente:</strong> No pudimos procesar el reembolso automáticamente. Nos pondremos en contacto contigo pronto para resolver esto.
                                </p>
                            </div>
                            `}

                            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
                                Adjunto encontrarás la nota de cancelación/devolución con los detalles completos del reembolso.
                            </p>

                            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
                                Si tienes alguna pregunta, no dudes en contactarnos.
                            </p>

                            <p style="color: #999; font-size: 13px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
                                Joyería Galiana<br>
                                <a href="mailto:info@joyeriagaliana.com" style="color: #d4af37; text-decoration: none;">info@joyeriagaliana.com</a>
                            </p>
                        </div>
                    </div>
                `,
                attachment: pdfBuffer ? {
                    content: pdfBuffer.toString('base64'),
                    name: `nota_cancelacion_${pedidoId}.pdf`
                } : undefined
            });

            if (emailResult.success) {
                console.log('[cancel-order] ✅ Email de cancelación enviado correctamente');
            } else {
                console.warn('[cancel-order] ⚠️ Error al enviar email de cancelación:', emailResult.error);
            }
        } catch (emailError) {
            console.error('[cancel-order] ⚠️ Error al enviar email de cancelación:', emailError);
        }

        // Email anterior removido
        return new Response(
            JSON.stringify({ 
                success: true, 
                message: 'Pedido cancelado correctamente',
                refundProcessed: refundProcessed
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('[cancel-order] Error:', error);
        return new Response(
            JSON.stringify({ 
                success: false, 
                message: 'Error al procesar la solicitud' 
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
