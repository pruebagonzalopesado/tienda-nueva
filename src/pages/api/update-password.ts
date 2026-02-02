import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { password } = await request.json();

    // Validar
    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Contraseña requerida' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[update-password] Supabase no configurado');
      return new Response(
        JSON.stringify({ error: 'Servidor no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log('[update-password] Actualizando contraseña');

    // Obtener el usuario actual desde la sesión
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[update-password] Usuario no autenticado:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado. Acceso denegado.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[update-password] Usuario:', user.email);

    // Actualizar contraseña
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error('[update-password] Error:', error.message);
      return new Response(
        JSON.stringify({ 
          error: error.message || 'Error al actualizar contraseña'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[update-password] ✅ Contraseña actualizada');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contraseña actualizada exitosamente'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[update-password] Exception:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Error desconocido' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
