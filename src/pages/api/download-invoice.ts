import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { generateInvoicePDF, obtenerDatosProducto } from '../../lib/invoice-generator';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const pedidoId = url.searchParams.get('id');
    const esReembolso = url.searchParams.get('reembolso') === 'true';

    if (!pedidoId) {
      return new Response(
        JSON.stringify({ error: 'ID de pedido requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[download-invoice] Descargando factura para pedido:', pedidoId, 'Reembolso:', esReembolso);

    // Obtener datos del pedido
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();

    if (error || !pedido) {
      console.error('[download-invoice] Error al obtener pedido:', error);
      return new Response(
        JSON.stringify({ error: 'Pedido no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Procesar items
    const items = typeof pedido.items === 'string' 
      ? JSON.parse(pedido.items) 
      : (pedido.items || []);

    console.log('[download-invoice] Items encontrados:', items.length);

    // Enriquecer productos con detalles
    const productosConDetalles: any[] = [];
    for (const item of items) {
      const detalles = await obtenerDatosProducto(item.product_id || item.id);
      productosConDetalles.push({
        id: item.product_id || item.id,
        nombre: item.nombre || detalles?.nombre || 'Producto',
        cantidad: item.cantidad || 1,
        precio_unitario: item.precio || 0,
        subtotal: item.subtotal || (item.precio * item.cantidad),
        imagen_url: detalles?.imagen_url,
        talla: item.talla
      });
    }

    // Generar PDF de factura
    const datosFactura = {
      numero_pedido: String(pedidoId),
      fecha: new Date(pedido.fecha_pedido || new Date()),
      cliente: {
        nombre: pedido.nombre_cliente || 'Cliente',
        email: pedido.email || '',
        telefono: pedido.telefono || 'No proporcionado',
        direccion: pedido.direccion || 'No proporcionada',
        ciudad: pedido.ciudad || 'No proporcionada',
        codigo_postal: pedido.codigo_postal || 'No proporcionado',
        pais: pedido.pais || 'ES'
      },
      productos: productosConDetalles,
      subtotal: pedido.subtotal || 0,
      envio: pedido.envio || 0,
      descuento: pedido.descuento || 0,
      total: pedido.total || 0,
      esReembolso: esReembolso
    };

    console.log('[download-invoice] Generando PDF...');
    const pdfBuffer = await generateInvoicePDF(datosFactura);
    console.log('[download-invoice] ✅ PDF generado exitosamente, tamaño:', pdfBuffer.length, 'bytes');

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="factura_${pedidoId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('[download-invoice] Error descargando factura:', error);
    return new Response(
      JSON.stringify({ error: 'Error al generar la factura', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
