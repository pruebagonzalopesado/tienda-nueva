// Autenticación con tabla usuarios
console.log('=== AUTH.JS CARGADO ===');
let currentUser = null;
let userRole = null;

// Funciones globales
window.openLoginModal = function() {
    console.log('openLoginModal llamada');
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
};

window.closeLoginModal = function() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
};

window.logout = async function() {
    if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
    }
    currentUser = null;
    userRole = null;
    window.location.href = '/';
};

// Cambiar entre tabs - función global
window.switchTab = function(e) {
    console.log('switchTab llamada', e);
    e.preventDefault();
    e.stopPropagation();
    
    const tabName = e.target.getAttribute('data-tab');
    console.log('Tab seleccionada:', tabName);
    
    // Actualizar tabs activos
    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Mostrar/ocultar formularios
    document.querySelectorAll('.auth-form').forEach(form => {
        console.log('Ocultando form:', form.id);
        form.classList.remove('active');
    });
    
    const activeForm = document.getElementById(tabName + '-form');
    if (activeForm) {
        console.log('Mostrando form:', activeForm.id);
        activeForm.classList.add('active');
    }
};

// Inicializar
function init() {
    console.log('init() llamada');
    
    // Esperar Supabase
    if (!window.supabaseClient) {
        console.log('Esperando supabaseClient...');
        setTimeout(init, 100);
        return;
    }
    
    console.log('Supabase client encontrado');
    supabase = window.supabaseClient;
    
    // Event listeners para tabs
    const tabs = document.querySelectorAll('.auth-tab');
    console.log('Tabs encontradas:', tabs.length);
    tabs.forEach(tab => {
        tab.addEventListener('click', window.switchTab);
        console.log('Listener agregado a tab:', tab.getAttribute('data-tab'));
    });
    
    // Formulario login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log('Login form listener agregado');
    }
    
    // Formulario registro
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        console.log('Register form listener agregado');
    }
    
    // Cerrar modal al clickear afuera
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) window.closeLoginModal();
        });
    }
    
    // Verificar sesión
    checkSession();
}

async function handleLogin(e) {
    e.preventDefault();
    console.log('handleLogin llamada');
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = this.querySelector('button[type="submit"]');
    
    btn.disabled = true;
    btn.textContent = 'Cargando...';
    
    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        
        if (error) throw error;
        
        currentUser = data.user;
        
        // Obtener rol del usuario
        const { data: usuario } = await window.supabaseClient
            .from('usuarios')
            .select('rol')
            .eq('email', currentUser.email)
            .single();
        
        userRole = usuario?.rol || 'user';
        
        if (userRole === 'admin') {
            window.location.href = '/admin';
        } else {
            window.closeLoginModal();
            updateAuthUI();
        }
    } catch (error) {
        alert('Error: ' + error.message);
        console.error('Login error:', error);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Iniciar Sesión';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('handleRegister llamada');
    
    const nombre = document.getElementById('register-nombre').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const btn = this.querySelector('button[type="submit"]');
    
    console.log('Datos:', { nombre, email });
    
    // Validaciones
    if (!nombre || !email || !password || !confirmPassword) {
        alert('Por favor rellena todos los campos');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
    }
    
    if (password.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Registrando...';
    
    try {
        console.log('Creando usuario en Auth...');
        // 1. Crear usuario en Auth
        const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
            email: email,
            password: password
        });
        
        if (authError) throw authError;
        
        console.log('Usuario creado:', authData.user.id);
        
        // 2. Hacer login automático para autenticarse
        console.log('Iniciando sesión automáticamente...');
        const { data: loginData, error: loginError } = await window.supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (loginError) throw loginError;
        
        console.log('Sesión iniciada:', loginData.user.id);
        
        // 3. Crear registro en tabla usuarios (ahora autenticado)
        console.log('Insertando en tabla usuarios...');
        const { error: dbError } = await window.supabaseClient.from('usuarios').insert([
            {
                id: loginData.user.id,
                email: email,
                nombre: nombre,
                rol: 'user',
                activo: true
            }
        ]);
        
        if (dbError) {
            console.error('Error en INSERT:', dbError);
            throw dbError;
        }
        
        console.log('Registro en BD exitoso');
        alert('¡Registro exitoso!');
        
        // 4. Actualizar UI porque ya está logueado
        currentUser = loginData.user;
        updateAuthUI();
        window.closeLoginModal();
        
    } catch (error) {
        alert('Error al registrarse: ' + error.message);
        console.error('Register error:', error);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Registrarse';
    }
}

async function checkSession() {
    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            const { data: usuario } = await window.supabaseClient
                .from('usuarios')
                .select('rol')
                .eq('email', currentUser.email)
                .single();
            userRole = usuario?.rol || 'user';
        }
        
        updateAuthUI();
    } catch (error) {
        console.error('Error verificando sesión:', error);
    }
}

function updateAuthUI() {
    const authBtn = document.getElementById('auth-button');
    if (!authBtn) return;
    
    if (currentUser) {
        authBtn.innerHTML = `
            <div class="user-menu">
                <button id="user-info-btn" class="btn-usuario">👤 ${currentUser.email.split('@')[0]}</button>
                <div id="user-dropdown" class="user-dropdown" style="display:none;">
                    ${userRole === 'admin' ? '<a href="/admin">Panel Admin</a>' : ''}
                    <button onclick="window.logout()">Cerrar Sesión</button>
                </div>
            </div>
        `;
        
        const userBtn = document.getElementById('user-info-btn');
        if (userBtn) {
            userBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const dd = document.getElementById('user-dropdown');
                if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
            });
        }
        
        document.addEventListener('click', function(e) {
            const dd = document.getElementById('user-dropdown');
            if (dd && !e.target.closest('.user-menu')) {
                dd.style.display = 'none';
            }
        });
    } else {
        authBtn.innerHTML = `<button onclick="window.openLoginModal()" class="btn-login">Iniciar Sesión</button>`;
    }
}

// Iniciar cuando esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
