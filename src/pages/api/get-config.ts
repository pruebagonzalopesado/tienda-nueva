import type { APIRoute } from 'astro';

/**
 * Endpoint seguro para obtener configuración pública del cliente
 * Las variables PUBLIC_* están diseñadas para ser públicas
 */
export const GET: APIRoute = async () => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: 'Configuración no disponible' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      supabaseUrl,
      supabaseAnonKey
    }),
    { 
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache por 1 hora
      }
    }
  );
};
