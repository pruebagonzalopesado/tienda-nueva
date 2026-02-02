import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY || '';

export const POST: APIRoute = async ({ request }) => {
    try {
        // Verificar que sea una solicitud POST
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Método no permitido' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Crear cliente de Supabase
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Obtener el archivo del formulario
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const carpeta = formData.get('carpeta') as string || 'productos';

        if (!file) {
            return new Response(JSON.stringify({ error: 'No file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`[UPLOAD] Archivo: ${file.name}, Carpeta: ${carpeta}, Tamaño: ${file.size}`);

        // Crear ruta con timestamp
        const nombreArchivo = `${Date.now()}_${file.name}`;
        const ruta = `${carpeta}/${nombreArchivo}`;

        // Convertir archivo a buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Subir a Supabase Storage
        const { data, error } = await supabase.storage
            .from('images')
            .upload(ruta, buffer, { upsert: true });

        if (error) {
            console.error('[UPLOAD] Error al subir:', error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`[UPLOAD] Subida exitosa: ${ruta}`);

        // Obtener URL pública
        const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(ruta);

        return new Response(JSON.stringify({ 
            url: urlData.publicUrl,
            path: ruta 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[UPLOAD] Error en endpoint:', error);
        return new Response(JSON.stringify({ 
            error: 'Error interno del servidor',
            details: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
