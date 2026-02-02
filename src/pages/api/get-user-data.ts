import type { APIRoute } from 'astro';

const SUPABASE_URL = 'https://tvzvuotqdtwmssxfnyqc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-XIdhOUa5OOaLbF45xNgzg_72CYzEw3';
const SUPABASE_SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Obtener el token del usuario desde los headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[get-user-data] Error: No authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[get-user-data] Token recibido:', token.substring(0, 20) + '...');

    // Primero obtener información del usuario (nombre, email) del endpoint de auth
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });

    if (!userResponse.ok) {
      console.log('[get-user-data] Error obteniendo usuario del auth:', userResponse.status);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401
      });
    }

    const user = await userResponse.json();
    console.log('[get-user-data] Usuario desde auth:', user.id, user.email);

    // Obtener datos adicionales del usuario desde la tabla usuarios
    const usuariosResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${user.id}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const usuariosData = await usuariosResponse.json();
    console.log('[get-user-data] Respuesta de REST API:', usuariosData);

    if (!Array.isArray(usuariosData) || usuariosData.length === 0) {
      console.log('[get-user-data] No hay datos en tabla usuarios');
      return new Response(JSON.stringify({
        user: {
          id: user.id,
          email: user.email
        },
        usuarioData: null
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const usuarioRecord = usuariosData[0];
    console.log('[get-user-data] Datos del usuario encontrados:', usuarioRecord);

    return new Response(JSON.stringify({
      user: {
        id: user.id,
        email: user.email
      },
      usuarioData: usuarioRecord
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('[get-user-data] Error no controlado:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500
    });
  }
};
