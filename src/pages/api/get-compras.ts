import { createClient } from "@supabase/supabase-js";

export async function POST({ request }) {
    try {
        const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
        const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Obtener el token de autenticación del header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'No autorizado', pedidos: [] }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const token = authHeader.replace('Bearer ', '');

        // Obtener usuario desde el token
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            console.error('[get-compras] Error al obtener usuario:', userError);
            return new Response(JSON.stringify({ error: 'Usuario no encontrado', pedidos: [] }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log('[get-compras] Usuario autenticado:', user.id);

        // Obtener pedidos del usuario
        const { data: pedidos, error: dbError } = await supabase
            .from('pedidos')
            .select('*')
            .eq('usuario_id', user.id)
            .order('fecha_creacion', { ascending: false });

        if (dbError) {
            console.error('[get-compras] Error al obtener pedidos:', dbError);
            return new Response(JSON.stringify({ error: 'Error al obtener pedidos', pedidos: [] }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log('[get-compras] Pedidos obtenidos:', pedidos?.length || 0);

        return new Response(JSON.stringify({ 
            error: null, 
            pedidos: pedidos || [],
            usuario_id: user.id 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[get-compras] Exception:', err);
        return new Response(JSON.stringify({ error: err.message, pedidos: [] }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
