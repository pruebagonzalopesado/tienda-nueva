// Autenticación con tabla usuarios - Updated: 2026-01-09 09:52
console.log('=== AUTH-NEW.JS CARGADO ===');
let currentUser = null;
let userRole = null;
let currentUserData = null; // Almacena {id, email, nombre, rol}

// Funciones globales
window.openLoginModal = function () {
    console.log('openLoginModal llamada');
    // Redirigir a la página de login
    window.location.href = '/admin/login';
};

window.closeLoginModal = function () {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
};

window.logout = async function () {
    try {
        console.log('LOGOUT INICIADO - INICIANDO SIGNOUT');

        // Guardar carrito en BD antes de cerrar sesión
        if (window.guardarCarritoAntesDeLogout) {
            console.log('Guardando carrito antes de logout...');
            await window.guardarCarritoAntesDeLogout();
        }

        // Limpiar variables locales PRIMERO
        currentUser = null;
        userRole = null;
        currentUserData = null;
        window.currentUserData = null;

        // Hacer signOut en Supabase (global y local)
        if (window.supabaseClient) {
            console.log('Ejecutando signOut en Supabase');
            // Hacer signOut global (cierra sesión en todos lados)
            await window.supabaseClient.auth.signOut({ scope: 'global' });
            console.log('SignOut completado');
        }

        // Forzar sesión a nula en el cliente de Supabase
        if (window.supabaseClient) {
            try {
                // Establecer sesión a null explícitamente
                await window.supabaseClient.auth.setSession(null);
                console.log('Sesión establecida a null');
            } catch (e) {
                console.warn('No se pudo establecer sesión a null:', e);
            }
        }

        // Guardar un timestamp de logout para validación de sesión
        window.logoutTimestamp = Date.now();
        localStorage.setItem('lastLogoutTime', Date.now().toString());
        
        // Guardar el carrito antes de limpiar
        const carritoBackup = localStorage.getItem('carrito');
        localStorage.clear();
        
        // Restaurar logout timestamp después de limpiar localStorage
        localStorage.setItem('lastLogoutTime', Date.now().toString());
        
        // Limpiar también sessionStorage
        sessionStorage.clear();
        
        // Limpiar cookies de Supabase manualmente
        document.cookie.split(";").forEach((c) => {
            document.cookie = c
                .replace(/^ +/, "")
                .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
        // Limpiar IndexedDB de Supabase
        console.log('Limpiando IndexedDB...');
        if (window.indexedDB) {
            try {
                const dbs = await window.indexedDB.databases();
                for (let db of dbs) {
                    console.log('Borrando DB:', db.name);
                    window.indexedDB.deleteDatabase(db.name);
                }
            } catch (e) {
                console.error('Error borrando IndexedDB:', e);
            }
        }

        console.log('Esperando 500ms antes de navegar...');
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('Navegando a raíz...');
        window.location.href = '/';

    } catch (error) {
        console.error('Error crítico en logout:', error);
        // Forzar reload aunque falle
        window.location.href = '/';
    }
};

// Cambiar entre tabs
window.switchTab = function (e) {
    console.log('switchTab llamada', e);
    e.preventDefault();
    e.stopPropagation();

    const tabName = e.target.getAttribute('data-tab');
    console.log('Tab seleccionada:', tabName);

    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
    });
    e.target.classList.add('active');

    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });

    const activeForm = document.getElementById(tabName + '-form');
    if (activeForm) {
        activeForm.classList.add('active');
    }
};

// Inicializar
function init() {
    console.log('init() llamada');

    if (!window.supabaseClient) {
        console.log('Esperando supabaseClient...');
        setTimeout(init, 100);
        return;
    }

    console.log('Supabase client encontrado');

    // Event listeners para tabs
    const tabs = document.querySelectorAll('.auth-tab');
    console.log('Tabs encontradas:', tabs.length);
    tabs.forEach(tab => {
        tab.addEventListener('click', window.switchTab);
    });

    // Formulario login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Formulario registro
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Cerrar modal al clickear afuera
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) window.closeLoginModal();
        });
    }

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

        const { data: usuario } = await window.supabaseClient
            .from('usuarios')
            .select('nombre, rol')
            .eq('email', currentUser.email)
            .single();

        userRole = usuario?.rol || 'user';

        // Si es admin, no permitir login desde la tienda
        if (userRole === 'admin') {
            // Cerrar sesión inmediatamente
            await window.supabaseClient.auth.signOut();
            throw new Error('Los administradores deben iniciar sesión desde el panel de administración');
        }

        // Guardar datos del usuario para mostrar en UI
        currentUserData = {
            id: currentUser.id,
            email: currentUser.email,
            nombre: usuario?.nombre || email.split('@')[0],
            rol: userRole
        };

        // Hacer currentUserData disponible globalmente para sincronización del carrito
        window.currentUserData = currentUserData;
        
        // Guardar en localStorage para que el Header pueda leerlo
        localStorage.setItem('currentUser', JSON.stringify(currentUserData));

        // Disparar evento para que otras páginas actualicen su UI (ej: checkout.js)
        document.dispatchEvent(new CustomEvent('userAuthenticated', { detail: currentUserData }));

        console.log('Cerrando modal y actualizando UI');
        window.closeLoginModal();
        updateAuthUI();

        // Sincronizar carrito con BD después de login (sin depender de carrito.js)
        console.log('Sincronizando carrito después de login...');
        await sincronizarCarritoDesdeAuth();
    } catch (error) {
        // Mostrar mensaje de error en la página en lugar de alert
        const errorContainer = document.getElementById('login-error') || createErrorContainer();
        errorContainer.textContent = error.message;
        errorContainer.style.display = 'block';
        console.error('Login error:', error);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Iniciar Sesión';
    }
}

// Función para crear contenedor de errores si no existe
function createErrorContainer() {
    const form = document.getElementById('login-form');
    let errorDiv = document.getElementById('login-error');
    if (!errorDiv && form) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'login-error';
        errorDiv.style.cssText = 'background: #ffebee; color: #c62828; padding: 12px 15px; border-radius: 8px; margin-bottom: 15px; font-size: 14px; text-align: center; display: none; border: 1px solid #ef9a9a;';
        form.insertBefore(errorDiv, form.firstChild);
    }
    return errorDiv;
}

// Función para crear contenedor de éxito en registro
function createSuccessContainer() {
    const form = document.getElementById('register-form');
    let successDiv = document.getElementById('register-success');
    if (!successDiv && form) {
        successDiv = document.createElement('div');
        successDiv.id = 'register-success';
        successDiv.style.cssText = 'background: #d4edda; color: #155724; padding: 12px 15px; border-radius: 8px; margin-bottom: 15px; font-size: 14px; text-align: center; display: none; border: 1px solid #c3e6cb;';
        form.insertBefore(successDiv, form.firstChild);
    }
    return successDiv;
}

async function handleRegister(e) {
    e.preventDefault();
    console.log('handleRegister llamada');

    const nombre = document.getElementById('register-nombre').value;
    const apellido = document.getElementById('register-apellido').value;
    const email = document.getElementById('register-email').value;
    const telefono = document.getElementById('register-telefono').value;
    const direccion = document.getElementById('register-direccion').value;
    const ciudad = document.getElementById('register-ciudad').value;
    const codigo_postal = document.getElementById('register-codigo-postal').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    const btn = this.querySelector('button[type="submit"]');

    if (!nombre || !email || !password || !confirmPassword) {
        alert('Por favor rellena todos los campos requeridos');
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
        const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (authError) throw authError;

        console.log('Usuario creado:', authData.user.id);
        console.log('Iniciando sesión automáticamente...');

        const { data: loginData, error: loginError } = await window.supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (loginError) throw loginError;

        console.log('Sesión iniciada:', loginData.user.id);
        console.log('Insertando en tabla usuarios...');

        const { error: dbError, data: insertData } = await window.supabaseClient.from('usuarios').insert([
            {
                id: loginData.user.id,
                email: email,
                nombre: nombre,
                apellido: apellido || null,
                telefono: telefono || null,
                direccion: direccion || null,
                ciudad: ciudad || null,
                codigo_postal: codigo_postal || null,
                contrasena: 'managed_by_auth',
                rol: 'user',
                activo: true
            }
        ]);

        if (dbError) {
            console.error('Error en INSERT:', dbError);
            throw dbError;
        }

        console.log('Registro en BD exitoso');
        
        // Mostrar mensaje de éxito en lugar de alert
        const successContainer = document.getElementById('register-success') || createSuccessContainer();
        successContainer.textContent = '¡Registro exitoso! Redirigiendo...';
        successContainer.style.display = 'block';

        currentUser = loginData.user;
        userRole = 'user';

        // Guardar datos del usuario para mostrar en UI
        currentUserData = {
            id: loginData.user.id,
            email: email,
            nombre: nombre,
            rol: 'user'
        };

        console.log('currentUserData guardado:', currentUserData);

        // Limpiar formulario de registro
        const registerForm = document.getElementById('register-form');
        if (registerForm) registerForm.reset();

        console.log('Actualizando UI y cerrando modal');
        updateAuthUI();
        window.closeLoginModal();

        // Enviar correo de bienvenida
        console.log('Enviando correo de bienvenida...');
        try {
            const emailResponse = await fetch('/api/send-welcome-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    nombre: nombre
                })
            });
            const emailData = await emailResponse.json();
            if (emailData.success) {
                console.log('Correo de bienvenida enviado:', emailData.messageId);
            } else {
                console.error('Error al enviar correo de bienvenida:', emailData.error);
            }
        } catch (err) {
            console.error('Error enviando correo:', err);
        }

        // Sincronizar carrito después del registro (sin depender de carrito.js)
        console.log('Sincronizando carrito después de registro...');
        await sincronizarCarritoDesdeAuth();

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
        console.log('checkSession() - START');

        // Primero intentar restaurar sesión desde Supabase
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        console.log('Session data:', session);

        if (session && session.user) {
            console.log('✅ Sesión activa encontrada en Supabase:', session.user.email);
            currentUser = session.user;

            // Obtener datos del usuario
            const { data: usuario, error } = await window.supabaseClient
                .from('usuarios')
                .select('nombre, rol')
                .eq('email', currentUser.email)
                .single();

            if (error) {
                console.error('Error obteniendo usuario:', error);
                userRole = 'user';
            } else {
                userRole = usuario?.rol || 'user';
            }

            // Guardar datos del usuario
            currentUserData = {
                id: currentUser.id,
                email: currentUser.email,
                nombre: usuario?.nombre || currentUser.email.split('@')[0],
                rol: userRole
            };

            // Hacer currentUserData disponible globalmente
            window.currentUserData = currentUserData;
            
            // Guardar en localStorage
            localStorage.setItem('currentUser', JSON.stringify(currentUserData));

            // Disparar evento
            document.dispatchEvent(new CustomEvent('userAuthenticated', { detail: currentUserData }));

            console.log('✅ currentUserData establecido:', currentUserData);
            updateAuthUI();
        } else {
            // Si no hay sesión en Supabase, intentar restaurar desde localStorage
            console.log('❌ No hay sesión en Supabase, buscando en localStorage...');
            const storedUser = localStorage.getItem('currentUser');
            
            if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    console.log('✅ Usuario encontrado en localStorage:', parsedUser.email);
                    
                    // Restaurar datos del usuario
                    currentUserData = parsedUser;
                    window.currentUserData = parsedUser;
                    userRole = parsedUser.rol || 'user';
                    
                    // Disparar evento
                    document.dispatchEvent(new CustomEvent('userAuthenticated', { detail: currentUserData }));
                    
                    console.log('✅ Sesión restaurada desde localStorage:', currentUserData);
                    updateAuthUI();
                } catch (e) {
                    console.error('Error parseando localStorage:', e);
                    currentUser = null;
                    userRole = null;
                    currentUserData = null;
                    window.currentUserData = null;
                    localStorage.removeItem('currentUser');
                    updateAuthUI();
                    return;
                }
            } else {
                console.log('❌ No hay sesión en Supabase ni en localStorage');
                currentUser = null;
                userRole = null;
                currentUserData = null;
                window.currentUserData = null;
                updateAuthUI();
                return;
            }
        }

        // Recargar carrito después de establecer sesión
        if (window.cargarCarrito && typeof window.cargarCarrito === 'function') {
            console.log('Llamando a cargarCarrito() después de verificar sesión');
            await window.cargarCarrito();
        } else {
            console.log('cargarCarrito no disponible, esperando...');
            // Esperar a que cargarCarrito esté disponible (se define en carrito.js)
            let intentos = 0;
            const esperar = () => {
                if (window.cargarCarrito && typeof window.cargarCarrito === 'function') {
                    console.log('cargarCarrito ahora disponible, llamando...');
                    window.cargarCarrito().catch(e => console.error('Error en cargarCarrito:', e));
                } else if (intentos < 20) {
                    intentos++;
                    setTimeout(esperar, 200);
                }
            };
            esperar();
        }
    } catch (error) {
        console.error('Error en checkSession:', error);
        currentUser = null;
        userRole = null;
        currentUserData = null;
        window.currentUserData = null;
        updateAuthUI();
    }
}

// Envoltura global para cargarCarrito (para que pueda ser llamada desde aquí)
// Esta será sobrescrita por carrito.js cuando cargue
if (!window.cargarCarrito) {
    window.cargarCarrito = async function() {
        console.log('cargarCarrito placeholder - será reemplazada por carrito.js');
        return Promise.resolve();
    };
}

// Función para sincronizar carrito después del login (independiente de carrito.js)
async function sincronizarCarritoDesdeAuth() {
    console.log('sincronizarCarritoDesdeAuth() - iniciando');
    
    const userId = currentUserData?.id;
    if (!userId || !window.supabaseClient) {
        console.log('No hay usuario o supabaseClient no disponible');
        return;
    }

    try {
        // Obtener carrito local
        const carritoLocal = JSON.parse(localStorage.getItem('carrito') || '[]');
        console.log('Carrito local:', carritoLocal.length, 'items');

        // El carrito solo se guarda en localStorage
        console.log('El carrito se mantiene en localStorage:', carritoLocal.length, 'items');

        // Actualizar UI sin recargar la página
        // 1. Actualizar contador del carrito
        if (typeof updateCartCount === 'function') {
            console.log('Actualizando contador del carrito');
            updateCartCount();
        }

        // 2. Re-renderizar el slide si está abierto
        if (typeof renderCartSlide === 'function' && window.cartSlideOpen) {
            console.log('Re-renderizando slide del carrito');
            renderCartSlide();
        }

        // 3. Llamar a cargarCarrito() si existe (para actualizar página de carrito)
        if (window.cargarCarrito && typeof window.cargarCarrito === 'function') {
            console.log('Llamando a cargarCarrito() para actualizar página');
            await window.cargarCarrito();
        }

    } catch (error) {
        console.error('Error en sincronizarCarritoDesdeAuth:', error);
    }
}

// Funciones auxiliares de sincronización removidas - el carrito solo se guarda en localStorage

function updateAuthUI() {
    const authBtn = document.getElementById('auth-button');
    if (!authBtn) {
        console.warn('auth-button no encontrado');
        return;
    }

    console.log('updateAuthUI - currentUser:', currentUser, 'currentUserData:', currentUserData);

    if (currentUser && currentUserData) {
        const displayName = currentUserData.nombre || currentUserData.email.split('@')[0];
        authBtn.innerHTML = `
            <div class="user-menu" style="display: flex; align-items: center; position: relative;">
                <button id="user-info-btn" class="btn-usuario" style="background: rgba(255, 255, 255, 0.1); color: white; border: 2px solid var(--color-principal); padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${displayName}</button>
                <div id="user-dropdown" class="user-dropdown" style="display:none; position: absolute; top: 100%; right: 0; background: var(--color-secundario); border: 2px solid var(--color-principal); border-radius: 5px; min-width: 200px; box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2); z-index: 1001; margin-top: 5px;">
                    <div class="user-info-dropdown" style="padding: 12px 15px; border-bottom: 1px solid rgba(212, 175, 55, 0.3); color: var(--color-principal);">
                        <strong style="display: block; margin-bottom: 5px; font-size: 14px;">${displayName}</strong>
                        <small style="display: block; font-size: 12px; color: rgba(255, 255, 255, 0.7);">${currentUserData.email}</small>
                    </div>
                    <button type="button" onclick="window.openEditPerfilModal()" style="display: block; width: 100%; padding: 12px 15px; color: #d4af37; font-size: 14px; font-weight: bold; text-decoration: none; border: none; background: none; cursor: pointer; text-align: left; transition: all 0.3s ease;">Mi Perfil</button>
                    <a href="/mis-compras" class="dropdown-item" style="display: block; width: 100%; padding: 12px 15px; color: #d4af37; font-size: 14px; text-decoration: none; border: none; background: none; cursor: pointer; text-align: left; transition: all 0.3s ease;">Mis Compras</a>
                    ${currentUserData.rol === 'admin' ? '<a href="/admin-panel.html" class="dropdown-item" style="display: block; width: 100%; padding: 12px 15px; color: #d4af37; font-size: 14px; text-decoration: none; border: none; background: none; cursor: pointer; text-align: left; transition: all 0.3s ease;">Panel Admin</a>' : ''}
                    <button type="button" onclick="doLogout()" style="display: block; width: 100%; padding: 12px 15px; color: #ff4444; font-size: 14px; font-weight: bold; text-decoration: none; border: none; background: none; cursor: pointer; text-align: left; transition: all 0.3s ease;">Cerrar Sesión</button>
                </div>
            </div>
        `;

        // Agregar eventos con delay más largo
        setTimeout(() => {
            const userBtn = document.getElementById('user-info-btn');
            const dropdown = document.getElementById('user-dropdown');

            if (userBtn && dropdown) {
                userBtn.onclick = function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Click en user-info-btn');
                    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                };
            }
        }, 50);

        // Cerrar dropdown al clickear fuera
        document.addEventListener('click', function (e) {
            const dropdown = document.getElementById('user-dropdown');
            const userMenu = document.querySelector('.user-menu');
            if (dropdown && userMenu && !userMenu.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    } else {
        authBtn.innerHTML = `<a href="#" onclick="window.openLoginModal(); return false;" style="color: var(--color-principal); text-decoration: none; font-weight: 600;">Iniciar Sesión</a>`;
    }
}

// Función global para logout
window.doLogout = function () {
    console.log('doLogout() LLAMADA DIRECTAMENTE');
    console.log('window.logout tipo:', typeof window.logout);

    if (typeof window.logout === 'function') {
        window.logout().then(() => {
            console.log('Logout completado via promise');
        }).catch(err => {
            console.error('Error en logout:', err);
            window.location.href = '/';
        });
    } else {
        console.error('window.logout no es una función!');
        window.location.href = '/';
    }

    return false; // Prevenir cualquier comportamiento por defecto
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
