import type { APIRoute } from 'astro';

const SUPABASE_URL = 'https://tvzvuotqdtwmssxfnyqc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-XIdhOUa5OOaLbF45xNgzg_72CYzEw3';

export const POST: APIRoute = async ({ request }) => {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { id, nombre, apellido, telefono, direccion, ciudad, codigo_postal, pais } = body;

    console.log('📝 Actualizando usuario:', id);
    console.log('📦 Datos:', { nombre, apellido, telefono, direccion, ciudad, codigo_postal, pais });

    // Validar que el usuario existe
    if (!id) {
      return new Response(JSON.stringify({ error: 'ID de usuario no proporcionado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener el token de autorización
    const authHeader = request.headers.get('authorization');
    let token = '';
    
    if (authHeader) {
      token = authHeader.replace('Bearer ', '');
      console.log('🔐 Token encontrado en headers');
    }

    // Usar REST API de Supabase para actualizar
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          nombre: nombre ? nombre.trim() : null,
          apellido: apellido ? apellido.trim() : null,
          telefono: telefono ? telefono.trim() : null,
          direccion: direccion ? direccion.trim() : null,
          ciudad: ciudad ? ciudad.trim() : null,
          codigo_postal: codigo_postal ? codigo_postal.trim() : null,
          pais: pais ? pais.trim() : null,
          updated_at: new Date().toISOString()
        })
      }
    );

    console.log('📡 Update response status:', updateResponse.status);

    if (!updateResponse.ok) {
      const errorData = await updateResponse.text();
      console.error('❌ Error de Supabase:', updateResponse.status, errorData);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Error al actualizar el perfil: ${updateResponse.status}` 
      }), {
        status: updateResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await updateResponse.json();
    console.log('✅ Perfil actualizado exitosamente:', data);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Perfil actualizado correctamente',
      data: data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('❌ Error en update-user-profile:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
