import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[register-discount-usage] Supabase no configurado');
      return new Response(
        JSON.stringify({ error: 'Supabase no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const data = await request.json();
    const { descuentoId, orderId } = data;

    console.log('[register-discount-usage] Datos recibidos:', { descuentoId, orderId });

    if (!descuentoId || !orderId) {
      console.warn('[register-discount-usage] Faltan parámetros');
      return new Response(
        JSON.stringify({ error: 'Faltan parámetros: descuentoId, orderId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener el descuento actual
    const { data: descuentoData, error: fetchError } = await supabase
      .from('descuentos')
      .select('id, usos_actuales')
      .eq('id', descuentoId)
      .single();

    if (fetchError || !descuentoData) {
      console.error('[register-discount-usage] Error obteniendo descuento:', fetchError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Descuento no encontrado: ${fetchError?.message || 'desconocido'}` 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[register-discount-usage] Descuento encontrado:', descuentoData);

    // Incrementar usos_actuales
    const nuevoUso = (descuentoData.usos_actuales || 0) + 1;
    console.log('[register-discount-usage] Incrementando uso: ', descuentoData.usos_actuales, ' → ', nuevoUso);

    const { data: updatedData, error: updateError } = await supabase
      .from('descuentos')
      .update({ 
        usos_actuales: nuevoUso,
        updated_at: new Date().toISOString()
      })
      .eq('id', descuentoId)
      .select();

    if (updateError) {
      console.error('[register-discount-usage] Error actualizando descuento:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Error al actualizar descuento: ${updateError.message}` 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[register-discount-usage] ✅ Descuento actualizado:', updatedData);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Descuento registrado correctamente',
        nuevoUso: nuevoUso,
        orderId: orderId
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[register-discount-usage] Exception:', error.message, error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Error desconocido' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
