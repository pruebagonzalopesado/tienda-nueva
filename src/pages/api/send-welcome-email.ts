import { sendWelcomeEmail } from '../../lib/brevo';

export async function POST({ request }: { request: Request }) {
    try {
        const body = await request.json();
        const { email, nombre } = body;

        if (!email || !nombre) {
            return new Response(
                JSON.stringify({ error: 'Email and name are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const result = await sendWelcomeEmail(email, nombre);

        if (!result.success) {
            return new Response(
                JSON.stringify({ error: result.error || 'Failed to send email' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, messageId: result.messageId }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Error in send-welcome-email:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
