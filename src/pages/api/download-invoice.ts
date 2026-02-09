import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { generateInvoicePDF, generateRefundInvoicePDF, obtenerDatosProducto } from '../../lib/invoice-generator';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const pedidoId = url.searchParams.get('id');
    const type = url.searchParams.get('type') || 'factura'; // 'factura' o 'devolucio'
    const esReembolso = url.searchParams.get('reembolso') === 'true';

    if (!pedidoId) {
      return new Response(
        JSON.stringify({ error: 'ID de pedido requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[download-invoice] Descargando:', type, 'para pedido:', pedidoId, 'Reembolso:', esReembolso);

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

    let items = typeof pedido.items === 'string' 
      ? JSON.parse(pedido.items) 
      : (pedido.items || []);

    // Si es devolución, obtener datos de la devolución
    let datosFactura: any;
    
    if (type === 'devolucio') {
      const { data: devoluciones, error: devError } = await supabase
        .from('devoluciones')
        .select('*')
        .eq('pedido_id', pedidoId)
        .in('estado', ['procesado', 'confirmada'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (devError || !devoluciones || devoluciones.length === 0) {
        console.error('[download-invoice] Error al obtener devolución:', devError);
        return new Response(
          JSON.stringify({ error: 'Devolución no encontrada para este pedido' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const devolucio = devoluciones[0];
      
      // Usar solo los items devueltos
      items = devolucio.items_devueltos || [];
      const montoReembolso = devolucio.monto_reembolso || 0;

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
          talla: item.talla
        });
      }

      // Estructura EXACTA como en manage-returns.ts
      datosFactura = {
        numero_pedido: `DEV-${pedidoId}`,
        fecha: new Date(),
        cliente: {
          nombre: devolucio.usuario_nombre || 'Cliente',
          email: devolucio.usuario_email,
          telefono: pedido?.telefono || 'No proporcionado',
          direccion: pedido?.direccion || 'No proporcionada',
          ciudad: pedido?.ciudad || 'No proporcionada',
          codigo_postal: pedido?.codigo_postal || 'No proporcionado',
          pais: pedido?.pais || 'ES'
        },
        productos: productosConDetalles,
        subtotal: montoReembolso,
        envio: 0,
        descuento: 0,
        total: montoReembolso,
        esDevolucion: true
      };
    } else {
      // Es una factura normal de compra
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

      datosFactura = {
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
        esReembolso: esReembolso,
        esDevolucion: false
      };
    }

    console.log('[download-invoice] Generando PDF...');
    
    // Usar la función de factura de devolución si es una devolución
    let pdfBuffer: Buffer;
    if (datosFactura.esDevolucion) {
      pdfBuffer = await generateRefundInvoicePDF(datosFactura);
    } else {
      pdfBuffer = await generateInvoicePDF(datosFactura);
    }
    
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
