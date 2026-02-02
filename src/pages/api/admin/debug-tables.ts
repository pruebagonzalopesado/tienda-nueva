import { supabase } from '../../../lib/supabase';

export const prerender = false;

export async function GET({ request }: { request: Request }) {
  try {
    // Obtener info de todas las tablas
    const { data: tables, error: tablesError } = await supabase!
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    console.log('[debug-tables] Tablas:', tables);
    console.log('[debug-tables] Error:', tablesError);

    // También intentar obtener datos de diferentes tablas posibles
    const possibleTables = ['pedidos', 'orders', 'compras', 'purchases', 'ventas', 'sales'];
    const results = {};

    for (const tableName of possibleTables) {
      try {
        const { data, error, count } = await supabase!
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(1);

        results[tableName] = {
          exists: !error,
          count,
          error: error?.message
        };
        console.log(`[debug-tables] ${tableName}:`, { count, error: error?.message });
      } catch (e) {
        results[tableName] = { exists: false, error: e.message };
      }
    }

    return new Response(JSON.stringify({
      tables: tables?.map(t => t.table_name),
      tableResults: results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[debug-tables] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
