// Inicializar Supabase PRIMERO
const SUPABASE_URL = 'https://tvzvuotqdtwmssxfnyqc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-XIdhOUa5OOaLbF45xNgzg_72CYzEw3';
window.SUPABASE_URL = SUPABASE_URL;

// Esperar a Supabase e inicializar inmediatamente
function initSupabaseNow() {
    if (typeof window.supabase !== 'undefined') {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.supabaseAdmin = window.supabaseClient;
        console.log('panel-init.js: Supabase inicializado correctamente');
    } else {
        setTimeout(initSupabaseNow, 50);
    }
}
initSupabaseNow();

// Verificar si hay sesión activa
console.log('=== INICIANDO VALIDACION DE SESION ===');
const authSession = localStorage.getItem('authSession');
const currentUser = localStorage.getItem('currentUser');

console.log('authSession existe:', !!authSession);
console.log('currentUser existe:', !!currentUser);
console.log('localStorage keys:', Object.keys(localStorage));

if (!authSession || !currentUser) {
    console.log('NO hay sesión activa, redirigiendo a login');
    window.location.href = '/admin-login.html';
} else {
    console.log('Sesión válida, renderizando panel');
    const user = JSON.parse(currentUser);
    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
        userEmailEl.textContent = user.email;
        console.log('Email del admin:', user.email);
    }
}

// Navegación entre secciones
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const sections = document.querySelectorAll('.admin-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            
            // Desactivar todos los enlaces y secciones
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Activar el seleccionado
            this.classList.add('active');
            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.add('active');
            }
        });
    });
});

// Cargar estadísticas desde API
console.log('=== CARGANDO ESTADISTICAS ===');
async function cargarEstadisticas() {
    try {
        const response = await fetch('/api/admin/get-stats');
        if (response.ok) {
            const data = await response.json();
            console.log('Stats cargadas:', data);
            
            const elProductos = document.getElementById('stat-productos');
            const elOfertas = document.getElementById('stat-ofertas');
            const elGaleria = document.getElementById('stat-galeria');
            const elPedidos = document.getElementById('stat-pedidos');
            
            if (elProductos) elProductos.textContent = data.productos || 0;
            if (elOfertas) elOfertas.textContent = data.ofertas || 0;
            if (elGaleria) elGaleria.textContent = data.galeria || 0;
            if (elPedidos) elPedidos.textContent = data.pedidos || 0;
        }
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cargarEstadisticas);
} else {
    cargarEstadisticas();
}

function irAPedidos(event) {
    event.preventDefault();
    window.location.href = '/admin/pedidos';
}
