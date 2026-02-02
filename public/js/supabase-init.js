// Inicializar Supabase con múltiples CDNs como fallback
const SUPABASE_URL = 'https://tvzvuotqdtwmssxfnyqc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-XIdhOUa5OOaLbF45xNgzg_72CYzEw3';

window.SUPABASE_URL = SUPABASE_URL;
let initAttempts = 0;
const maxAttempts = 200;

function tryInitSupabase() {
    initAttempts++;
    
    // Intentar con window.supabase (unpkg)
    if (window.supabase && window.supabase.createClient) {
        try {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            window.supabaseAdmin = window.supabaseClient;
            console.log('✓ Supabase inicializado correctamente (unpkg)');
            return true;
        } catch (e) {
            console.error('Error al crear cliente Supabase:', e);
        }
    }
    
    // Intentar con window.supabaseLib (skypack)
    if (window.supabaseLib && window.supabaseLib.createClient) {
        try {
            window.supabaseClient = window.supabaseLib.createClient(SUPABASE_URL, SUPABASE_KEY);
            window.supabaseAdmin = window.supabaseClient;
            console.log('✓ Supabase inicializado correctamente (skypack)');
            return true;
        } catch (e) {
            console.error('Error al crear cliente Supabase:', e);
        }
    }
    
    if (initAttempts < maxAttempts) {
        if (initAttempts % 50 === 0) {
            console.log(`Esperando Supabase... intento ${initAttempts}/${maxAttempts}`);
        }
        setTimeout(tryInitSupabase, 50);
    } else {
        console.error('No se pudo cargar Supabase después de', maxAttempts, 'intentos');
    }
}

// Iniciar inmediatamente
tryInitSupabase();
