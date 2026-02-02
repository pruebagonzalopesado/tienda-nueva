import PDFDocument from 'pdfkit';
import { supabase } from './supabase';

interface ProductoFactura {
  id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  imagen_url?: string;
  talla?: string;
}

interface DatosFactura {
  numero_pedido: string;
  fecha: Date;
  cliente: {
    nombre: string;
    email: string;
    telefono: string;
    direccion: string;
    ciudad: string;
    codigo_postal: string;
    pais: string;
  };
  productos: ProductoFactura[];
  subtotal: number;
  envio: number;
  descuento: number;
  total: number;
  esReembolso?: boolean;
}

/**
 * Genera un PDF de factura con el logo, datos del cliente y productos
 */
export async function generateInvoicePDF(datos: DatosFactura): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 30
      });

      const buffers: Buffer[] = [];

      doc.on('data', (chunk: any) => {
        buffers.push(chunk as Buffer);
      });

      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      doc.on('error', (error: any) => {
        reject(error);
      });

      // ===== HEADER CON LOGO =====
      try {
        // Usar URL pública del logo
        const logoUrl = 'https://joyeriagaliana.com/images/logo.png';
        // En desarrollo, cambiar a localhost
        const isDevMode = !process.env.VERCEL;
        const actualLogoUrl = isDevMode ? 'http://localhost:3000/images/logo.png' : logoUrl;
        
        doc.image(actualLogoUrl, 30, 30, { width: 80, height: 80 });
      } catch (logoErr) {
        console.warn('⚠️ No se pudo cargar el logo:', logoErr);
        // Continuar sin logo
      }

      // Datos de empresa
      doc.fontSize(18)
        .font('Helvetica-Bold')
        .text('JOYERÍA GALIANA', 120, 35);

      doc.fontSize(10)
        .font('Helvetica')
        .text('Sanlúcar de Barrameda, España', 120, 60)
        .text('Email: info@joyeriagaliana.com', 120, 75)
        .text('Teléfono: +34 XXX XXX XXX', 120, 90);

      // ===== NÚMERO Y FECHA DE FACTURA =====
      const tipoDocumento = datos.esReembolso ? 'NOTA DE REEMBOLSO' : 'FACTURA';
      doc.fontSize(14)
        .font('Helvetica-Bold')
        .text(tipoDocumento, 450, 35);

      doc.fontSize(10)
        .font('Helvetica')
        .text(`${datos.esReembolso ? 'Reembolso' : 'Factura'} #${datos.numero_pedido}`, 450, 65)
        .text(`Fecha: ${datos.fecha.toLocaleDateString('es-ES')}`, 450, 80);

      // ===== LÍNEA SEPARADORA =====
      doc.moveTo(30, 125)
        .lineTo(565, 125)
        .stroke();

      // ===== DATOS DEL CLIENTE =====
      let yPosition = 145;

      doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('DATOS DEL CLIENTE', 30, yPosition);

      yPosition += 20;

      doc.fontSize(9)
        .font('Helvetica')
        .text(`Nombre: ${datos.cliente.nombre}`, 30, yPosition)
        .text(`Email: ${datos.cliente.email}`, 30, yPosition + 12)
        .text(`Teléfono: ${datos.cliente.telefono}`, 30, yPosition + 24)
        .text(`Dirección: ${datos.cliente.direccion}`, 30, yPosition + 36)
        .text(`${datos.cliente.codigo_postal} ${datos.cliente.ciudad}, ${datos.cliente.pais}`, 30, yPosition + 48);

      yPosition += 85;

      // ===== LÍNEA SEPARADORA =====
      doc.moveTo(30, yPosition)
        .lineTo(565, yPosition)
        .stroke();

      yPosition += 20;

      // ===== TABLA DE PRODUCTOS =====
      doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('PRODUCTOS', 30, yPosition);

      yPosition += 25;

      // Headers de tabla
      const tableTop = yPosition;
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('Descripción', 30, tableTop)
        .text('Cantidad', 280, tableTop)
        .text('Precio Unit.', 330, tableTop)
        .text('Subtotal', 420, tableTop);

      // Línea bajo headers
      doc.moveTo(30, tableTop + 12)
        .lineTo(565, tableTop + 12)
        .stroke();

      yPosition = tableTop + 30;

      // Filas de productos
      doc.fontSize(9)
        .font('Helvetica');

      for (const producto of datos.productos) {
        // Verificar si hay espacio para producto + imagen
        const espacioRequerido = 35; // Para imagen pequeña
        if (yPosition + espacioRequerido > 700) {
          doc.addPage();
          yPosition = 30;
        }

        const currentY = yPosition;

        // Nombre del producto (columna izquierda más ancha)
        let nombreProducto = producto.nombre;
        if (producto.talla) {
          nombreProducto += ` (Talla: ${producto.talla})`;
        }
        doc.text(nombreProducto, 30, currentY, { width: 240 });

        // Cantidad
        doc.text(String(producto.cantidad), 280, currentY);

        // Precio unitario
        doc.text(`€ ${producto.precio_unitario.toFixed(2)}`, 330, currentY);

        // Subtotal
        doc.text(`€ ${producto.subtotal.toFixed(2)}`, 420, currentY);

        // Intentar agregar imagen del producto si existe
        if (producto.imagen_url) {
          try {
            // Validar que sea una URL HTTP válida
            if (producto.imagen_url.startsWith('http')) {
              const imgX = 480;
              const imgY = currentY - 5;
              doc.image(producto.imagen_url, imgX, imgY, { width: 65, height: 35 });
            }
          } catch (imgErr) {
            console.warn('⚠️ Error cargando imagen de producto:', imgErr);
            // Ignorar error de imagen
          }
        }

        yPosition += 40;
      }

      // Línea separadora antes de totales
      doc.moveTo(30, yPosition)
        .lineTo(565, yPosition)
        .stroke();

      yPosition += 20;

      // ===== TOTALES =====
      doc.fontSize(10)
        .font('Helvetica');

      const totalLabelX = 350;
      const totalValueX = 450;
      const multiplicador = datos.esReembolso ? -1 : 1;
      const colorReembolso = datos.esReembolso ? '#ff4444' : '#000000';

      // Subtotal
      if (datos.esReembolso) {
        doc.fillColor(colorReembolso);
      }
      doc.text('Subtotal:', totalLabelX, yPosition)
        .text(`${datos.esReembolso ? '-' : ''}€ ${Math.abs(datos.subtotal).toFixed(2)}`, totalValueX, yPosition);

      // Envío
      yPosition += 20;
      doc.text('Gastos de envío:', totalLabelX, yPosition)
        .text(`${datos.esReembolso ? '-' : ''}€ ${Math.abs(datos.envio).toFixed(2)}`, totalValueX, yPosition);

      // Descuento
      if (datos.descuento > 0) {
        yPosition += 20;
        if (!datos.esReembolso) {
          doc.text('Descuento:', totalLabelX, yPosition)
            .text(`-€ ${datos.descuento.toFixed(2)}`, totalValueX, yPosition);
        }
      }

      // Total
      yPosition += 25;
      doc.fontSize(12)
        .font('Helvetica-Bold')
        .text(datos.esReembolso ? 'REEMBOLSO:' : 'TOTAL:', totalLabelX - 30, yPosition)
        .fontSize(14)
        .text(`${datos.esReembolso ? '-' : ''}€ ${Math.abs(datos.total).toFixed(2)}`, totalValueX, yPosition);

      // Restaurar color si fue modificado
      if (datos.esReembolso) {
        doc.fillColor('#000000');
      }

      // ===== FOOTER =====
      yPosition = 740;

      doc.fontSize(9)
        .font('Helvetica')
        .text('Gracias por tu compra. Todos nuestros productos están garantizados.', 30, yPosition)
        .text('Si tienes dudas, contacta con nosotros.', 30, yPosition + 15);

      yPosition += 35;

      doc.moveTo(30, yPosition)
        .lineTo(565, yPosition)
        .stroke();

      doc.fontSize(8)
        .text('© 2026 Joyería Galiana. Todos los derechos reservados.', 30, yPosition + 10, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Obtiene los datos del producto desde Supabase
 */
export async function obtenerDatosProducto(productId: string) {
  try {
    const { data, error } = await supabase!
      .from('products')
      .select('id, nombre, precio, imagen_url, referencia')
      .eq('id', productId)
      .single();

    if (error) {
      console.error('Error fetching product:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in obtenerDatosProducto:', error);
    return null;
  }
}

/**
 * Genera un PDF de factura de devolución
 */
export async function generateRefundInvoicePDF(datos: DatosFactura): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 30
      });

      const buffers: Buffer[] = [];

      doc.on('data', (chunk: any) => {
        buffers.push(chunk as Buffer);
      });

      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      doc.on('error', (error: any) => {
        reject(error);
      });

      // ===== HEADER =====
      doc.fontSize(28)
        .font('Helvetica-Bold')
        .text('NOTA DE DEVOLUCIÓN', 30, 50, { align: 'center' })
        .fontSize(11)
        .font('Helvetica')
        .text('Factura de devolución y reembolso', 30, 85, { align: 'center' });

      // ===== INFORMACIÓN BÁSICA =====
      let yPosition = 120;

      doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('Información del Documento', 30, yPosition);

      yPosition += 20;

      const infoItems = [
        { label: 'Número:', value: datos.numero_pedido },
        { label: 'Fecha de Devolución:', value: datos.fecha.toLocaleDateString('es-ES') },
        { label: 'Cliente:', value: datos.cliente.nombre }
      ];

      doc.fontSize(9).font('Helvetica');
      infoItems.forEach((item) => {
        doc.text(`${item.label} ${item.value}`, 30, yPosition);
        yPosition += 15;
      });

      yPosition += 10;

      // ===== TABLA DE PRODUCTOS =====
      doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('PRODUCTOS DEVUELTOS', 30, yPosition);

      yPosition += 25;

      const tableTop = yPosition;
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('Descripción', 30, tableTop)
        .text('Cantidad', 280, tableTop)
        .text('Precio Unit.', 330, tableTop)
        .text('Subtotal', 420, tableTop);

      doc.moveTo(30, tableTop + 12)
        .lineTo(565, tableTop + 12)
        .stroke();

      yPosition = tableTop + 30;
      doc.fontSize(9).font('Helvetica');

      for (const producto of datos.productos) {
        const espacioRequerido = 35;
        if (yPosition + espacioRequerido > 700) {
          doc.addPage();
          yPosition = 30;
        }

        const currentY = yPosition;

        let nombreProducto = producto.nombre;
        if (producto.talla) {
          nombreProducto += ` (Talla: ${producto.talla})`;
        }
        doc.text(nombreProducto, 30, currentY, { width: 240 });
        doc.text(String(producto.cantidad), 280, currentY);
        doc.text(`€ ${producto.precio_unitario.toFixed(2)}`, 330, currentY);
        doc.text(`€ ${producto.subtotal.toFixed(2)}`, 420, currentY);

        yPosition += 40;
      }

      doc.moveTo(30, yPosition)
        .lineTo(565, yPosition)
        .stroke();

      yPosition += 20;

      // ===== RESUMEN FINANCIERO =====
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('RESUMEN DE REEMBOLSO', 30, yPosition);

      yPosition += 25;

      const summaryItems = [
        { label: 'Subtotal Devuelto:', value: `€ ${datos.subtotal.toFixed(2)}` },
        { label: 'Envío:', value: `€ ${datos.envio.toFixed(2)}` }
      ];

      doc.fontSize(9).font('Helvetica');
      summaryItems.forEach((item) => {
        doc.text(item.label, 30, yPosition);
        doc.text(item.value, 450, yPosition, { align: 'right' });
        yPosition += 20;
      });

      doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('TOTAL A REEMBOLSAR:', 30, yPosition);

      doc.text(`€ ${datos.total.toFixed(2)}`, 450, yPosition, { align: 'right' });

      yPosition += 40;

      // ===== NOTAS IMPORTANTES =====
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('INFORMACIÓN IMPORTANTE', 30, yPosition);

      yPosition += 20;

      const notasTexto = [
        '• Este documento confirma la devolución de los productos listados arriba.',
        '• El reembolso se procesará en los próximos 5-10 días hábiles a tu método de pago original.',
        '• Por cualquier pregunta, no dudes en contactarnos a info@joyeriagaliana.com',
        '• Consulta nuestra política de devoluciones en www.joyeriagaliana.com'
      ];

      doc.fontSize(8).font('Helvetica');
      notasTexto.forEach((nota) => {
        doc.text(nota, 30, yPosition, { width: 500 });
        yPosition += 15;
      });

      yPosition += 20;

      // ===== FOOTER =====
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text('Joyería Galiana', 30, yPosition, { align: 'center' })
        .fontSize(8)
        .font('Helvetica')
        .text('Sanlúcar de Barrameda, España | info@joyeriagaliana.com', 30, yPosition + 20, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
