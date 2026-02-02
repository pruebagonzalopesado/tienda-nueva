import { supabase } from '../../../lib/supabase';

export const prerender = false;

export async function GET({ request }: { request: Request }) {
  try {
    // Verificar que hay sesión
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[get-sales-data] Sesión verificada, obteniendo datos...');

    // Obtener el primer día del mes actual
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 1. Ventas totales del mes en euros (excluyendo cancelados y devoluciones)
    const { data: allPedidosMes } = await supabase!
      .from('pedidos')
      .select('total, estado, fecha_creacion')
      .gte('fecha_creacion', firstDayOfMonth.toISOString())
      .lte('fecha_creacion', lastDayOfMonth.toISOString());

    const pedidosMes = (allPedidosMes || []).filter(p => 
      p.estado !== 'cancelado' && p.estado !== 'devolucion_proceso'
    );

    console.log('[get-sales-data] Pedidos del mes:', pedidosMes.length);
    console.log('[get-sales-data] Primer pedido:', pedidosMes[0]);

    const totalMes = pedidosMes.reduce((sum, p) => sum + (p.total || 0), 0);

    // 2. Producto más vendido del mes (excluyendo cancelados y devoluciones)
    const { data: allPedidosMonthData } = await supabase!
      .from('pedidos')
      .select('items, estado, fecha_creacion')
      .gte('fecha_creacion', firstDayOfMonth.toISOString())
      .lte('fecha_creacion', lastDayOfMonth.toISOString());

    const pedidosMonthData = (allPedidosMonthData || []).filter(p => 
      p.estado !== 'cancelado' && p.estado !== 'devolucion_proceso'
    );

    const productCountMap: { [key: string]: { cantidad: number; nombre: string; precio: number } } = {};
    
    if (pedidosMonthData) {
      for (const pedido of pedidosMonthData) {
        if (pedido.items) {
          try {
            const items = typeof pedido.items === 'string' 
              ? JSON.parse(pedido.items) 
              : pedido.items;
            
            if (Array.isArray(items)) {
              for (const item of items) {
                if (!productCountMap[item.id]) {
                  productCountMap[item.id] = {
                    cantidad: 0,
                    nombre: item.nombre || 'Producto desconocido',
                    precio: item.precio || 0
                  };
                }
                productCountMap[item.id].cantidad += item.cantidad || 1;
              }
            }
          } catch (e) {
            console.error('Error parsing items:', e);
          }
        }
      }
    }

    let productoMasVendido = null;
    let maxCantidad = 0;

    for (const [productId, data] of Object.entries(productCountMap)) {
      if (data.cantidad > maxCantidad) {
        maxCantidad = data.cantidad;
        productoMasVendido = {
          nombre: data.nombre,
          cantidad: data.cantidad,
          precio: data.precio
        };
      }
    }

    // 3. Ventas de los últimos 7 días (excluyendo cancelados y devoluciones)
    const hace7Dias = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const { data: allPedidos7Dias } = await supabase!
      .from('pedidos')
      .select('fecha_creacion, total, estado')
      .gte('fecha_creacion', hace7Dias.toISOString())
      .order('fecha_creacion', { ascending: true });

    const pedidos7Dias = (allPedidos7Dias || []).filter(p => 
      p.estado !== 'cancelado' && p.estado !== 'devolucion_proceso'
    );

    console.log('[get-sales-data] Pedidos últimos 7 días:', pedidos7Dias.length);

    // Agrupar ventas por día
    const salesByDay: { [key: string]: number } = {};
    const últimos7Días = [];

    for (let i = 6; i >= 0; i--) {
      const fecha = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const fechaStr = fecha.toISOString().split('T')[0];
      const nombreDia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][fecha.getDay()];
      últimos7Días.push({
        fecha: fechaStr,
        día: nombreDia,
        total: 0
      });
      salesByDay[fechaStr] = 0;
    }

    if (pedidos7Dias) {
      for (const pedido of pedidos7Dias) {
        const fecha = pedido.fecha_creacion.split('T')[0];
        if (salesByDay[fecha] !== undefined) {
          salesByDay[fecha] += pedido.total || 0;
        }
      }
    }

    // Llenar los datos en el array
    for (let i = 0; i < últimos7Días.length; i++) {
      últimos7Días[i].total = salesByDay[últimos7Días[i].fecha];
    }

    return new Response(JSON.stringify({
      ventasDelMes: parseFloat(totalMes.toFixed(2)),
      productoMasVendido: productoMasVendido || {
        nombre: 'Sin datos',
        cantidad: 0,
        precio: 0
      },
      ventasÚltimos7Días: últimos7Días
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[get-sales-data] Error:', error);
    return new Response(JSON.stringify({ error: 'Error al obtener datos' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
