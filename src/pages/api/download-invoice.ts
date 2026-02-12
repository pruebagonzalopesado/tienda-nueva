import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { generateInvoicePDF, obtenerDatosProducto } from '../../lib/invoice-generator';

export const GET: APIRoute = async ({ url }) => {
  try {
    const pedidoId = url.searchParams.get('id') || url.searchParams.get('pedidoId');

    console.log('[download-invoice] >>> Iniciando descarga de factura');
    console.log('[download-invoice]     - Pedido ID: ' + pedidoId);

    // Validar que se proporcionó pedidoId
    if (!pedidoId) {
      console.error('[download-invoice] Falta id o pedidoId');
      return new Response(
        JSON.stringify({ error: 'Falta id o pedidoId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener variables de entorno
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[download-invoice] Supabase no configurado');
      return new Response(
        JSON.stringify({ error: 'Supabase no configurado' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Obtener pedido de Supabase
    console.log('[download-invoice] 🔍 Buscando pedido en Supabase...');
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();

    if (pedidoError || !pedido) {
      console.error('[download-invoice] Pedido no encontrado:', pedidoError);
      return new Response(
        JSON.stringify({ error: 'Pedido no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[download-invoice] ✅ Pedido encontrado:', pedidoId);

    // Obtener items del pedido
    let items = typeof pedido.items === 'string' 
      ? JSON.parse(pedido.items) 
      : (pedido.items || []);

    // Enriquecer items del pedido
    console.log('[download-invoice] 🔄 Enriqueciendo datos de productos...');
    const productosEnriquecidos = [];

    for (const item of items) {
      console.log(`[download-invoice]   Obteniendo datos del producto: ${item.product_id}`);
      const datosProducto = await obtenerDatosProducto(item.product_id);

      if (datosProducto) {
        productosEnriquecidos.push({
          id: item.product_id,
          nombre: datosProducto.nombre || item.nombre,
          cantidad: item.cantidad,
          precio_unitario: datosProducto.precio || item.precio,
          subtotal: (datosProducto.precio || item.precio) * item.cantidad,
          imagen_url: datosProducto.imagen_url,
          talla: item.talla,
        });
      } else {
        // Usar datos del item si no se puede obtener el producto
        productosEnriquecidos.push({
          id: item.product_id,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: item.precio,
          subtotal: item.precio * item.cantidad,
          talla: item.talla,
        });
      }
    }

    console.log('[download-invoice] ✅ Datos de productos enriquecidos');

    // Crear objeto datosFactura
    const datosFactura = {
      numero_pedido: pedidoId.toString(),
      fecha: new Date(pedido.fecha_creacion || new Date()),
      cliente: {
        nombre: pedido.nombre,
        email: pedido.email,
        telefono: pedido.telefono || '',
        direccion: pedido.direccion,
        ciudad: pedido.ciudad,
        codigo_postal: pedido.codigo_postal || '',
        pais: pedido.pais || 'España',
      },
      productos: productosEnriquecidos,
      subtotal: pedido.subtotal,
      envio: pedido.envio,
      descuento: 0,
      total: pedido.total,
    };

    // Generar PDF
    console.log('[download-invoice] 📄 Generando PDF de factura...');
    let pdfBuffer: Buffer;

    try {
      pdfBuffer = await generateInvoicePDF(datosFactura);

      if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
        console.error('[download-invoice] PDF generado inválido');
        return new Response(
          JSON.stringify({ error: 'Error al generar el PDF' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[download-invoice] ✅ PDF generado exitosamente (${pdfBuffer.length} bytes)`);
    } catch (pdfError) {
      console.error('[download-invoice] ❌ Error generando PDF:', pdfError);
      return new Response(
        JSON.stringify({ error: 'Error al generar el PDF' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Retornar PDF
    console.log('[download-invoice] 📤 Enviando PDF al cliente...');

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="factura_${pedidoId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('[download-invoice] ❌ Error:', error.message);
    console.error('[download-invoice] Stack:', error.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
