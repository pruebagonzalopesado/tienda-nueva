import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email } = await request.json();

    // Validar email
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[request-password-reset] Supabase no configurado');
      return new Response(
        JSON.stringify({ error: 'Servidor no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log('[request-password-reset] Solicitando reset para:', email);

    // Construir URL correcta
    const redirectUrl = 'https://galiana.victoriafp.online/reset-password';

    console.log('[request-password-reset] URL de redirección:', redirectUrl);

    // Enviar enlace de recuperación con Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      console.error('[request-password-reset] Error:', error.message);
      // Supabase devuelve error si el email no existe en la BD
      const errorMessage = error.message?.includes('user') || error.message?.includes('not found')
        ? 'No existe una cuenta con este correo electrónico'
        : error.message || 'Error al enviar email';
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[request-password-reset] ✅ Email de recuperación enviado');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Enlace de recuperación enviado'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[request-password-reset] Exception:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Error desconocido' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
