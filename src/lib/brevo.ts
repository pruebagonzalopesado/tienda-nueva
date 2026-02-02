/**
 * Servicio de email con Brevo (Sendinblue)
 */

interface Attachment {
    content: string; // base64 encoded
    name: string;
}

interface EmailData {
    to: Array<{ email: string; name?: string }>;
    subject: string;
    htmlContent: string;
    textContent?: string;
    attachment?: Attachment;
}

interface EmailResponse {
    success: boolean;
    messageId?: string;
    error?: string;
}

const BREVO_API_KEY = import.meta.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = import.meta.env.BREVO_FROM_EMAIL;
const BREVO_FROM_NAME = import.meta.env.BREVO_FROM_NAME;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Envía un correo a través de Brevo
 */
export async function sendEmail(data: EmailData): Promise<EmailResponse> {
    if (!BREVO_API_KEY || !BREVO_FROM_EMAIL) {
        console.error('Brevo API key o FROM email no configurados');
        return {
            success: false,
            error: 'Email service not configured'
        };
    }

    try {
        const payload: any = {
            sender: {
                name: BREVO_FROM_NAME || 'Joyería Galiana',
                email: BREVO_FROM_EMAIL
            },
            to: data.to,
            subject: data.subject,
            htmlContent: data.htmlContent,
            textContent: data.textContent || data.htmlContent
        };

        // Agregar adjunto si existe
        if (data.attachment) {
            payload.attachment = [{
                content: data.attachment.content,
                name: data.attachment.name
            }];
        }

        const response = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'api-key': BREVO_API_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Brevo API error:', error);
            return {
                success: false,
                error: error.message || 'Failed to send email'
            };
        }

        const result = await response.json();
        return {
            success: true,
            messageId: result.messageId
        };
    } catch (error) {
        console.error('Error sending email via Brevo:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Envía correo de confirmación de registro
 */
export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<EmailResponse> {
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
                    .header { background: linear-gradient(135deg, #d4af37 0%, #c9a227 100%); color: white; padding: 40px 20px; text-align: center; }
                    .header h1 { font-size: 28px; font-weight: 300; letter-spacing: 2px; margin-bottom: 10px; }
                    .header p { font-size: 14px; opacity: 0.9; }
                    .content { padding: 40px 30px; background: #fafafa; }
                    .greeting { font-size: 18px; color: #d4af37; margin-bottom: 20px; font-weight: 500; }
                    .message { font-size: 14px; line-height: 1.8; color: #555; margin-bottom: 30px; }
                    .benefit-box { background: white; border-left: 4px solid #d4af37; padding: 20px; margin: 20px 0; border-radius: 3px; }
                    .benefit-box h3 { color: #d4af37; font-size: 14px; margin-bottom: 8px; }
                    .benefit-box p { font-size: 13px; color: #666; }
                    .cta-button { display: inline-block; background: #d4af37; color: white; padding: 14px 40px; text-decoration: none; border-radius: 3px; font-weight: 500; margin: 20px 0; font-size: 14px; }
                    .cta-button:hover { background: #c9a227; }
                    .footer { background: #2c2c2c; color: #d4af37; padding: 30px; text-align: center; font-size: 12px; }
                    .footer p { margin: 8px 0; }
                    .logo-text { font-size: 24px; font-weight: 300; letter-spacing: 1px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>JOYERÍA GALIANA</h1>
                        <p>Lujo y Elegancia en Cada Detalle</p>
                    </div>
                    
                    <div class="content">
                        <div class="greeting">¡Bienvenido, ${userName}!</div>
                        
                        <div class="message">
                            <p>Nos complace darte la bienvenida a la familia Joyería Galiana. Tu cuenta ha sido creada exitosamente y ya puedes disfrutar de todas nuestras colecciones exclusivas.</p>
                        </div>
                        
                        <div class="benefit-box">
                            <h3>ACCESO EXCLUSIVO</h3>
                            <p>Accede a ofertas especiales, promociones anticipadas y colecciones limitadas disponibles solo para nuestros clientes registrados.</p>
                        </div>
                        
                        <div class="benefit-box">
                            <h3>ENVIOS SEGUROS</h3>
                            <p>Todos nuestros productos son cuidadosamente embalados y asegurados. Recibirás tu compra en perfectas condiciones.</p>
                        </div>
                        
                        <div class="benefit-box">
                            <h3>GARANTIA DE CALIDAD</h3>
                            <p>Cada pieza es seleccionada con cuidado. Garantizamos la autenticidad y calidad de todos nuestros productos.</p>
                        </div>
                        
                        <center>
                            <a href="https://joyeriagaliana.com" class="cta-button">EXPLORAR COLECCIONES</a>
                        </center>
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

    return sendEmail({
        to: [{ email: userEmail, name: userName }],
        subject: '¡Bienvenido a Joyería Galiana!',
        htmlContent
    });
}

/**
 * Envía correo de confirmación de pedido
 */
export async function sendOrderConfirmationEmail(
    userEmail: string,
    userName: string,
    orderId: string,
    items: Array<{ nombre: string; precio: number; cantidad: number }>,
    total: number
): Promise<EmailResponse> {
    const itemsHTML = items
        .map(
            item => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.nombre}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.cantidad}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">€${item.precio.toFixed(2)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">€${(item.precio * item.cantidad).toFixed(2)}</td>
            </tr>
        `
        )
        .join('');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #d4af37; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th { background-color: #d4af37; color: white; padding: 10px; text-align: left; }
                    .total-row { background-color: #e8e8e8; font-weight: bold; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>¡Pedido Confirmado!</h1>
                    </div>
                    <div class="content">
                        <p>Hola ${userName},</p>
                        <p>Gracias por tu pedido. Aquí está el resumen de tu compra:</p>
                        <p><strong>Número de pedido:</strong> ${orderId}</p>
                        <table>
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Cantidad</th>
                                    <th>Precio</th>
                                    <th>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHTML}
                                <tr class="total-row">
                                    <td colspan="3" style="padding: 10px;">Total:</td>
                                    <td style="padding: 10px; text-align: right;">€${total.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <p>Te notificaremos cuando tu pedido sea enviado. Si tienes alguna pregunta, no dudes en contactarnos.</p>
                    </div>
                    <div class="footer">
                        <p>© 2026 Joyería Galiana. Todos los derechos reservados.</p>
                        <p>Sanlúcar de Barrameda, España</p>
                    </div>
                </div>
            </body>
        </html>
    `;

    return sendEmail({
        to: [{ email: userEmail, name: userName }],
        subject: `Pedido Confirmado #${orderId}`,
        htmlContent
    });
}

/**
 * Envía correo de pago exitoso
 */
export async function sendPaymentSuccessEmail(
    userEmail: string,
    userName: string,
    pedidoId: number | string,
    amount: number,
    pdfBuffer?: Buffer,
    pedidoData?: any
): Promise<EmailResponse> {
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
                    .next-steps { background: white; border-left: 4px solid #d4af37; padding: 20px; margin: 20px 0; border-radius: 3px; }
                    .next-steps h4 { color: #8b1538; font-size: 14px; margin-bottom: 10px; }
                    .next-steps ol { padding-left: 20px; font-size: 13px; color: #666; line-height: 1.8; }
                    .next-steps li { margin: 8px 0; }
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
                        <div class="greeting">¡Gracias, ${userName}!</div>
                        
                        <div class="success-message">
                            <p>Tu pedido ha sido confirmado exitosamente. La factura detallada se adjunta a este email.</p>
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
                                <span class="detail-value">€ ${(pedidoData?.subtotal || amount).toFixed(2)}</span>
                            </div>
                            ${pedidoData?.envio && pedidoData.envio > 0 ? `
                            <div class="detail-row">
                                <span class="detail-label">Envío:</span>
                                <span class="detail-value">€ ${pedidoData.envio.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div class="total-box">
                                <span>TOTAL:</span>
                                <span class="amount">€ ${amount.toFixed(2)}</span>
                            </div>
                        </div>

                        ${pdfBuffer ? `
                        <div class="pdf-notice">
                            <strong>📎 Factura adjunta:</strong> Encontrarás la factura detallada en formato PDF adjunto a este email. Por favor descárgala y guárdala para tus registros.
                        </div>
                        ` : ''}

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://galiana.victoriafp.online/seguimiento-paquetes" style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #c9a324 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 14px; transition: all 0.3s ease;">
                                Seguir mi Pedido
                            </a>
                            <p style="font-size: 12px; color: #999; margin-top: 10px;">Ingresa tu email y número de pedido para ver el estado</p>
                        </div>
                        
                        <div class="next-steps">
                            <h4>QUE OCURRE AHORA</h4>
                            <ol>
                                <li>Tu pedido será procesado y preparado en nuestro almacén</li>
                                <li>Recibirás un email de confirmación de envío con número de seguimiento</li>
                                <li>Tu paquete será entregado de manera segura en la dirección proporcionada</li>
                                <li>Si tienes dudas, puedes ver tu pedido en "Mis Compras" o usar "Seguir mi Pedido"</li>
                            </ol>
                        </div>
                        
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

    const emailData: any = {
        to: [{ email: userEmail, name: userName }],
        subject: `Pedido Realizado #${pedidoId}`,
        htmlContent
    };

    // Agregar PDF si existe
    if (pdfBuffer) {
        console.log('[sendPaymentSuccessEmail] PDF disponible, adjuntando al email...');
        try {
            const base64PDF = pdfBuffer.toString('base64');
            console.log('[sendPaymentSuccessEmail] PDF codificado en base64, tamaño:', base64PDF.length, 'bytes');
            emailData.attachment = {
                content: base64PDF,
                name: `factura_${pedidoId}.pdf`
            };
            console.log('[sendPaymentSuccessEmail] Attachment configurado exitosamente');
        } catch (error) {
            console.error('[sendPaymentSuccessEmail] Error al codificar PDF:', error);
        }
    } else {
        console.warn('[sendPaymentSuccessEmail] No hay pdfBuffer disponible');
    }

    return sendEmail(emailData);
}
