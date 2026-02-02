import type { APIRoute } from 'astro';
import { generateInvoicePDF } from '../../lib/invoice-generator';

export const GET: APIRoute = async () => {
  try {
    console.log('🧪 [test-pdf] Iniciando test de generación de PDF...');

    const datosFactura = {
      numero_pedido: 'TEST-001',
      fecha: new Date(),
      cliente: {
        nombre: 'Test Cliente',
        email: 'test@example.com',
        telefono: '123456789',
        direccion: 'Calle Test 123',
        ciudad: 'Test City',
        codigo_postal: '12345',
        pais: 'ES'
      },
      productos: [
        {
          id: '1',
          nombre: 'Anillo de Plata Test',
          cantidad: 1,
          precio_unitario: 50,
          subtotal: 50,
          imagen_url: 'https://example.com/image.jpg'
        }
      ],
      subtotal: 50,
      envio: 5,
      descuento: 0,
      total: 55
    };

    console.log('🧪 [test-pdf] Generando PDF...');
    const pdfBuffer = await generateInvoicePDF(datosFactura);
    
    console.log('🧪 [test-pdf] PDF generado, tamaño:', pdfBuffer.length, 'bytes');

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="test-factura.pdf"'
      }
    });
  } catch (error: any) {
    console.error('❌ [test-pdf] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
