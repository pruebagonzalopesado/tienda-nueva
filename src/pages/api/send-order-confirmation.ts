import { sendPaymentSuccessEmail } from '../../lib/brevo';

export async function POST({ request }: { request: Request }) {
    try {
        const body = await request.json();
        const { email, nombre, orderId, amount, items = [], envio = 0 } = body;

        if (!email || !nombre || !orderId || !amount) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const subtotal = items.length > 0 
            ? items.reduce((sum: number, item: any) => sum + ((item.precio || 0) * (item.cantidad || 1)), 0)
            : amount;

        const result = await sendPaymentSuccessEmail(
            email,
            nombre,
            orderId,
            amount as number,
            undefined,
            { subtotal, envio }
        );

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
        console.error('Error in send-payment-success:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

