import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL || '',
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || ''
);

export const POST: APIRoute = async (context) => {
    try {
        // Verificar que sea admin (opcional, pero recomendado)
        const authHeader = context.request.headers.get('authorization');
        
        console.log('🔧 Iniciando diagnóstico de newsletter_logs...');

        // 1. Verificar que la tabla existe
        const { data: tableCheck, error: tableError } = await supabase
            .from('newsletter_logs')
            .select('count(*)', { count: 'exact' })
            .limit(1);

        if (tableError) {
            console.error('❌ Error accediendo a newsletter_logs:', tableError);
            
            // Intentar crear la tabla
            const { error: createError } = await supabase.rpc('exec_sql', {
                sql: `
                    CREATE TABLE IF NOT EXISTS newsletter_logs (
                        id BIGSERIAL PRIMARY KEY,
                        subject VARCHAR(255) NOT NULL,
                        total_recipients INTEGER NOT NULL,
                        emails_sent INTEGER NOT NULL,
                        sent_by VARCHAR(255),
                        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    
                    ALTER TABLE newsletter_logs ENABLE ROW LEVEL SECURITY;
                    
                    CREATE POLICY IF NOT EXISTS "Permitir lectura pública de logs" ON newsletter_logs
                        FOR SELECT
                        TO public
                        USING (true);
                    
                    CREATE POLICY IF NOT EXISTS "Permitir inserción de logs" ON newsletter_logs
                        FOR INSERT
                        TO public
                        WITH CHECK (true);
                `
            }).catch(e => ({ error: e }));
            
            if (createError) {
                console.warn('⚠️ No se pudo crear tabla mediante RPC:', createError);
            }
        }

        // 2. Intentar una inserción de prueba
        const testLog = {
            subject: '[TEST] Verificación de tabla',
            total_recipients: 0,
            emails_sent: 0,
            sent_by: 'system-check',
            sent_at: new Date().toISOString()
        };

        const { error: insertError, data: inserted } = await supabase
            .from('newsletter_logs')
            .insert([testLog])
            .select();

        if (insertError) {
            console.error('❌ Error al insertar en newsletter_logs:', insertError);
            
            // Si falla por RLS, hay que arreglarlo manualmente
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'No se puede insertar en newsletter_logs',
                    details: insertError,
                    recommendation: 'Ejecutar fix-newsletter-logs-rls.sql manualmente en Supabase SQL Editor'
                }),
                { 
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // 3. Si insertó correctamente, eliminar el registro de prueba
        if (inserted && inserted.length > 0) {
            await supabase
                .from('newsletter_logs')
                .delete()
                .eq('sent_by', 'system-check')
                .ilike('subject', '%TEST%');
        }

        console.log('✅ newsletter_logs funciona correctamente');

        return new Response(
            JSON.stringify({
                success: true,
                message: 'newsletter_logs está funcionando correctamente',
                tableExists: true,
                canInsert: true
            }),
            { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('Error en diagnóstico:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: 'Error en diagnóstico',
                details: error instanceof Error ? error.message : 'Unknown'
            }),
            { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
};
