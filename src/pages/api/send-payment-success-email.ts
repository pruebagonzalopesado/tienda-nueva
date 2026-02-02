import type { APIRoute } from 'astro';
import { sendPaymentSuccessEmail } from '../../lib/brevo';
import { generateInvoicePDF, obtenerDatosProducto } from '../../lib/invoice-generator';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { email, nombre, orderId, amount, items = [] } = data;

    console.log('📧 [send-payment-success-email] Recibiendo solicitud de email');
    console.log('   Email:', email);
    console.log('   Nombre:', nombre);
    console.log('   Order ID:', orderId);
    console.log('   Amount:', amount);
    console.log('   Items:', items);

    if (!email) {
      console.error('📧 [send-payment-success-email] ❌ Falta email');
      return new Response(
        JSON.stringify({ error: 'Email requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener datos del pedido desde Supabase para generar la factura
    let pdfBuffer: Buffer | undefined;
    try {
      console.log('📧 [send-payment-success-email] Obteniendo datos del pedido...');
      
      const { data: pedidoData, error: pedidoError } = await supabase!
        .from('pedidos')
        .select('*')
        .eq('id', orderId)
        .single();

      if (!pedidoError && pedidoData) {
        console.log('📧 [send-payment-success-email] Datos del pedido obtenidos');
        
        // Enriquecer datos de productos
        const productosConDetalles = [];
        
        if (items && items.length > 0) {
          for (const item of items) {
            const detalles = await obtenerDatosProducto(item.product_id);
            productosConDetalles.push({
              id: item.product_id || 'desconocido',
              nombre: item.nombre || detalles?.nombre || 'Producto',
              cantidad: item.cantidad || 1,
              precio_unitario: item.precio || 0,
              subtotal: item.subtotal || (item.precio * item.cantidad),
              imagen_url: detalles?.imagen_url,
              talla: item.talla || undefined
            });
          }
        }

        const datosFactura = {
          numero_pedido: String(orderId),
          fecha: new Date(pedidoData.fecha_pedido || new Date()),
          cliente: {
            nombre: pedidoData.nombre_cliente || nombre || 'Cliente',
            email: email,
            telefono: pedidoData.telefono || 'No proporcionado',
            direccion: pedidoData.direccion || 'No proporcionada',
            ciudad: pedidoData.ciudad || 'No proporcionada',
            codigo_postal: pedidoData.codigo_postal || 'No proporcionado',
            pais: pedidoData.pais || 'ES'
          },
          productos: productosConDetalles.length > 0 ? productosConDetalles : [
            {
              id: 'items',
              nombre: 'Productos del pedido',
              cantidad: 1,
              precio_unitario: pedidoData.subtotal || 0,
              subtotal: pedidoData.subtotal || 0
            }
          ],
          subtotal: pedidoData.subtotal || 0,
          envio: pedidoData.envio || 0,
          descuento: pedidoData.descuento || 0,
          total: pedidoData.total || amount
        };

        console.log('📧 [send-payment-success-email] Generando factura PDF...');
        pdfBuffer = await generateInvoicePDF(datosFactura);
        console.log('✅ [send-payment-success-email] Factura PDF generada exitosamente');
      } else {
        console.warn('⚠️ [send-payment-success-email] No se encontraron datos del pedido');
      }
    } catch (pdfError) {
      console.error('⚠️ [send-payment-success-email] Error generando PDF de factura:', pdfError);
      // Continuar sin PDF, no es un error crítico
    }

    console.log('📧 [send-payment-success-email] Llamando a sendPaymentSuccessEmail()...');
    
    // Preparar datos básicos del pedido para el email
    const pedidoData = {
      subtotal: items.reduce((sum: number, item: any) => sum + ((item.precio || 0) * (item.cantidad || 1)), 0),
      envio: data.envio || 0
    };
    
    const result = await sendPaymentSuccessEmail(
      email,
      nombre || 'Cliente',
      orderId,
      parseFloat(amount) || 0,
      pdfBuffer,
      pedidoData
    );

    console.log('📧 [send-payment-success-email] Resultado:', result);

    if (result.success) {
      console.log('✅ [send-payment-success-email] Email enviado:', result.messageId);
      return new Response(
        JSON.stringify({ success: true, messageId: result.messageId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('❌ [send-payment-success-email] Error:', result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('❌ [send-payment-success-email] Excepción:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
