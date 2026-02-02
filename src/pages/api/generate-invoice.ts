import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const GET: APIRoute = async (context) => {
  try {
    const pedidoId = context.url.searchParams.get('pedidoId');
    
    if (!pedidoId) {
      return new Response('ID de pedido requerido', { status: 400 });
    }

    // Obtener datos del pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', parseInt(pedidoId))
      .single();

    if (pedidoError || !pedido) {
      return new Response('Pedido no encontrado', { status: 404 });
    }

    // Parsear items
    let items = [];
    if (pedido.items) {
      items = typeof pedido.items === 'string' ? JSON.parse(pedido.items) : pedido.items;
    } else if (pedido.productos_json) {
      items = typeof pedido.productos_json === 'string' ? JSON.parse(pedido.productos_json) : pedido.productos_json;
    }

    // Generar HTML del PDF
    const fecha = new Date(pedido.fecha_creacion).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const productosHtml = items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.nombre || 'Producto'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.cantidad || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">€${(item.precio || 0).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">€${((item.precio || 0) * (item.cantidad || 1)).toFixed(2)}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Factura Pedido #${pedido.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
          .container { max-width: 800px; margin: 0 auto; padding: 40px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #d4af37; padding-bottom: 20px; }
          .header-left h1 { color: #8b1538; font-size: 28px; margin-bottom: 10px; }
          .header-left p { color: #666; font-size: 12px; }
          .header-right { text-align: right; }
          .invoice-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { padding: 15px; background: #f5f5f5; border-radius: 4px; }
          .info-label { font-weight: 600; color: #8b1538; font-size: 12px; margin-bottom: 5px; }
          .info-value { font-size: 14px; }
          table { width: 100%; margin-bottom: 30px; border-collapse: collapse; }
          table thead { background: #d4af37; color: white; }
          table th { padding: 12px; text-align: left; font-weight: 600; }
          .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
          .totals-box { width: 300px; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .totals-row.total { border-bottom: 2px solid #d4af37; font-weight: 600; font-size: 16px; padding: 15px 0; color: #8b1538; }
          .footer { text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-left">
              <h1>JOYERÍA GALIANA</h1>
              <p>Calle Barrameda, 21 | Sanlúcar de Barrameda, Cádiz</p>
              <p>Email: info@joyeriagaliana.com</p>
            </div>
            <div class="header-right">
              <h2 style="color: #d4af37; font-size: 32px; margin-bottom: 10px;">FACTURA</h2>
              <p style="font-size: 14px; color: #666;">Pedido #${pedido.id}</p>
            </div>
          </div>

          <div class="invoice-info">
            <div class="info-box">
              <div class="info-label">CLIENTE</div>
              <div class="info-value">${pedido.nombre}</div>
              <div class="info-value">${pedido.email}</div>
            </div>
            <div class="info-box">
              <div class="info-label">FECHA DE PEDIDO</div>
              <div class="info-value">${fecha}</div>
              <div class="info-label" style="margin-top: 10px;">ESTADO</div>
              <div class="info-value">${pedido.estado.charAt(0).toUpperCase() + pedido.estado.slice(1)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th style="text-align: center;">Cantidad</th>
                <th style="text-align: right;">Precio Unitario</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${productosHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-box">
              <div class="totals-row">
                <span>Subtotal:</span>
                <span>€${(pedido.subtotal || 0).toFixed(2)}</span>
              </div>
              <div class="totals-row">
                <span>Gastos de Envío:</span>
                <span>€${(pedido.envio || 0).toFixed(2)}</span>
              </div>
              <div class="totals-row total">
                <span>TOTAL:</span>
                <span>€${pedido.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Gracias por tu compra. Para cualquier duda contacta con nosotros.</p>
            <p style="margin-top: 10px;">© 2026 Joyería Galiana. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Crear PDF usando html2pdf (generaremos HTML que el navegador puede convertir)
    // Para una solución más robusta, usaríamos una librería como puppeteer
    // Por ahora, devolveremos un archivo HTML que el usuario puede imprimir como PDF

    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="factura-pedido-${pedido.id}.html"`
      }
    });

  } catch (error) {
    console.error('[generate-invoice] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error al generar la factura'
      }),
      { status: 500 }
    );
  }
};
