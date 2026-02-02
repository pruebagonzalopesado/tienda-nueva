import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL || '',
    supabaseKey || ''
);

export const POST: APIRoute = async ({ request }) => {
    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ success: false, error: 'Método no permitido' }),
            { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const body = await request.json();
        const { nombre, email, asunto, mensaje } = body;

        console.log('📧 Nuevo mensaje de contacto:', { nombre, email, asunto });

        // Validar campos requeridos
        if (!nombre || !email || !asunto || !mensaje) {
            console.warn('❌ Campos incompletos:', { nombre, email, asunto, mensaje: mensaje ? 'sí' : 'no' });
            return new Response(
                JSON.stringify({ 
                    success: false,
                    error: 'Todos los campos son requeridos' 
                }),
                { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // Guardar mensaje en base de datos
        console.log('💾 Guardando mensaje en Supabase...');
        const { data, error } = await supabase
            .from('contact_messages')
            .insert([
                {
                    nombre: nombre,
                    email: email,
                    asunto: asunto,
                    mensaje: mensaje,
                    leido: false,
                    respondido: false
                }
            ]);

        if (error) {
            console.error('❌ Error de Supabase:', error);
            return new Response(
                JSON.stringify({ 
                    success: false,
                    error: 'Error al guardar el mensaje',
                    details: error.message
                }),
                { 
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        console.log('✅ Mensaje guardado exitosamente:', data);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Mensaje enviado correctamente. Nos pondremos en contacto pronto.',
                data: data
            }),
            { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('❌ Error in send-contact:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Error interno del servidor',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
            { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
};
