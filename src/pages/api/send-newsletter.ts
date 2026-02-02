import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL || '',
    supabaseKey || ''
);

// Función para enviar emails por Brevo (uno a uno)
async function sendEmailViaBrevo(
    emails: Array<{ email: string; name?: string }>,
    subject: string,
    htmlContent: string
) {
    const BREVO_API_KEY = import.meta.env.BREVO_API_KEY;
    const BREVO_FROM_EMAIL = import.meta.env.BREVO_FROM_EMAIL;
    const BREVO_FROM_NAME = import.meta.env.BREVO_FROM_NAME || 'Joyería Galiana';

    // Si no está configurado, usar modo mock
    if (!BREVO_API_KEY || !BREVO_FROM_EMAIL) {
        console.warn('⚠️ Brevo no configurado - modo mock');
        return {
            success: true,
            messageId: 'mock-' + Date.now(),
            sentCount: emails.length,
        };
    }

    try {
        let sentCount = 0;
        let failedEmails = [];

        // Enviar a cada persona individualmente
        for (const recipient of emails) {
            const payload = {
                sender: {
                    name: BREVO_FROM_NAME,
                    email: BREVO_FROM_EMAIL,
                },
                to: [
                    {
                        email: recipient.email,
                        name: recipient.name || recipient.email,
                    }
                ],
                subject: subject,
                htmlContent: htmlContent,
                textContent: htmlContent,
                replyTo: {
                    email: BREVO_FROM_EMAIL,
                    name: BREVO_FROM_NAME
                },
                headers: {
                    'X-Mailer': 'Joyeria-Galiana-Newsletter/1.0'
                }
            };

            try {
                const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'api-key': BREVO_API_KEY,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    console.error(`Brevo API error for ${recipient.email}:`, errorData);
                    failedEmails.push(recipient.email);
                } else {
                    sentCount++;
                    console.log(`✅ Email enviado a ${recipient.email}`);
                    // Pequeña pausa entre emails
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (emailError) {
                console.error(`Error sending email to ${recipient.email}:`, emailError);
                failedEmails.push(recipient.email);
            }
        }

        return {
            success: sentCount > 0,
            sentCount: sentCount,
            failedEmails: failedEmails.length > 0 ? failedEmails : undefined,
        };
    } catch (error) {
        console.error('Error sending email via Brevo:', error);
        return {
            success: false,
            sentCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

export const POST: APIRoute = async ({ request }) => {
    try {
        // Verificar que sea POST
        if (request.method !== 'POST') {
            return new Response(
                JSON.stringify({ error: 'Method not allowed' }),
                { status: 405 }
            );
        }

        const data = await request.json();
        const { subject, htmlContent, adminEmail } = data;

        // Validar campos requeridos
        if (!subject || !htmlContent) {
            return new Response(
                JSON.stringify({ error: 'Asunto y contenido requeridos' }),
                { status: 400 }
            );
        }

        // Verificar que sea admin (opcional: verificar token)
        // Por ahora asumimos que si hace la petición, está autenticado

        // Obtener todos los suscriptores activos
        const { data: subscribers, error: fetchError } = await supabase
            .from('newsletter_subscribers')
            .select('email')
            .eq('status', 'activo');

        if (fetchError) {
            console.error('Error fetching subscribers:', fetchError);
            return new Response(
                JSON.stringify({ 
                    success: false,
                    error: 'Error al obtener suscriptores' 
                }),
                { 
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        if (!subscribers || subscribers.length === 0) {
            return new Response(
                JSON.stringify({ 
                    success: true, 
                    message: 'No hay suscriptores activos',
                    emailsSent: 0,
                    totalRecipients: 0
                }),
                { 
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // Enviar emails en lotes de 5 para no sobrecargar Brevo
        const emailList = subscribers.map((sub: any) => ({
            email: sub.email,
            name: sub.email.split('@')[0] // Usar parte del email como nombre
        }));

        // Dividir en lotes más pequeños para evitar sobrecargar
        const batchSize = 5;  // Reducido de 10 a 5
        let emailsSent = 0;
        let errors = [];
        const delayBetweenBatches = 1000; // 1 segundo entre lotes

        for (let i = 0; i < emailList.length; i += batchSize) {
            const batch = emailList.slice(i, i + batchSize);
            
            const emailResult = await sendEmailViaBrevo(batch, subject, htmlContent);

            if (emailResult.success) {
                emailsSent += emailResult.sentCount || batch.length;
                if (emailResult.failedEmails && emailResult.failedEmails.length > 0) {
                    errors.push({
                        batch: Math.floor(i / batchSize) + 1,
                        failedEmails: emailResult.failedEmails
                    });
                }
            } else {
                errors.push({
                    batch: Math.floor(i / batchSize) + 1,
                    error: emailResult.error
                });
            }

            // Pausa entre lotes para no exceder límites de rate de Brevo
            // 1 segundo entre cada lote de 5 emails
            if (i + batchSize < emailList.length) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }

        // Registrar en logs
        try {
            await supabase.from('newsletter_logs').insert([
                {
                    subject: subject,
                    total_recipients: subscribers.length,
                    emails_sent: emailsSent,
                    sent_by: 'admin@joyeriagaliana.es',
                    sent_at: new Date().toISOString(),
                },
            ]);
        } catch (logError) {
            console.warn('Warning: No se pudo registrar el log:', logError);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Newsletter enviado exitosamente`,
                emailsSent: emailsSent,
                totalRecipients: subscribers.length,
                errors: errors.length > 0 ? errors : undefined
            }),
            { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('Error in send-newsletter:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
            { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
};
