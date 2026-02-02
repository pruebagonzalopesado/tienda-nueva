import { createClient } from '@supabase/supabase-js';

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[clear-cart API] Limpiando carrito para usuario:', userId);

    // Crear cliente Supabase usando import.meta.env
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[clear-cart API] Supabase no configurado:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
      return new Response(
        JSON.stringify({ success: false, error: 'Supabase no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Eliminar todos los items del carrito para este usuario
    const { error } = await supabase
      .from('carrito')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[clear-cart API] Error eliminando carrito:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[clear-cart API] ✅ Carrito limpiado exitosamente para usuario:', userId);

    return new Response(
      JSON.stringify({ success: true, message: 'Carrito limpiado' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[clear-cart API] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
