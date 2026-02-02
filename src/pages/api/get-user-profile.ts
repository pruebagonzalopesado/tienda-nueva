import type { APIRoute } from 'astro';

const SUPABASE_URL = 'https://tvzvuotqdtwmssxfnyqc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-XIdhOUa5OOaLbF45xNgzg_72CYzEw3';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const userId = url.searchParams.get('id');

    console.log('📝 Obteniendo datos del usuario:', userId);

    if (!userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ID de usuario no proporcionado' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener el token de autorización desde los headers
    const authHeader = request.headers.get('authorization');
    let token = '';
    
    if (authHeader) {
      token = authHeader.replace('Bearer ', '');
      console.log('🔐 Token encontrado en headers');
    }

    // Obtener datos del usuario desde la tabla usuarios
    const usuariosResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${userId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('📡 Response status:', usuariosResponse.status);

    if (!usuariosResponse.ok) {
      console.error('❌ Error obteniendo usuario:', usuariosResponse.status);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Error al obtener el usuario' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const usuarios = await usuariosResponse.json();
    console.log('✅ Respuesta de Supabase:', usuarios);

    if (!usuarios || usuarios.length === 0) {
      console.log('⚠️ Usuario no encontrado en tabla usuarios');
      // Retornar usuario vacío para que se rellenen manualmente
      return new Response(JSON.stringify({
        success: true,
        user: {
          id: userId,
          email: '',
          nombre: '',
          apellido: '',
          telefono: '',
          direccion: '',
          ciudad: '',
          codigo_postal: '',
          pais: '',
          rol: 'user'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Usuario obtenido:', usuarios[0]);
    
    return new Response(JSON.stringify({
      success: true,
      user: usuarios[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('❌ Error en get-user-profile:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
