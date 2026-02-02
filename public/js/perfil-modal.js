// Modal de edición de perfil
console.log('✅ perfil-modal.js cargado');

window.openEditPerfilModal = async function() {
    console.log('📋 Abriendo modal de edición de perfil');
    
    // Obtener datos del usuario actual desde localStorage
    const currentUserStr = localStorage.getItem('currentUser');
    let currentUserData = window.currentUserData;
    
    if (currentUserStr) {
        try {
            const storedUser = JSON.parse(currentUserStr);
            currentUserData = { ...currentUserData, ...storedUser };
            console.log('✅ Datos del usuario desde localStorage:', storedUser);
        } catch (e) {
            console.error('Error parsing currentUser:', e);
        }
    }
    
    if (!currentUserData || !currentUserData.id) {
        alert('Error: No hay usuario logueado');
        return;
    }
    
    console.log('📦 Datos del usuario (desde localStorage):', currentUserData);
    
    // Crear el modal si no existe
    let modal = document.getElementById('edit-perfil-modal');
    if (!modal) {
        createEditPerfilModal();
        modal = document.getElementById('edit-perfil-modal');
    }
    
    // Guardar el ID del usuario
    if (modal) {
        modal.dataset.userId = currentUserData.id;
    }
    
    // Mostrar el modal
    if (modal) {
        modal.style.display = 'flex';
    }
    
    // Cerrar el dropdown si está abierto
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    // Mostrar loading
    const statusDiv = document.getElementById('perfil-status');
    if (statusDiv) {
        statusDiv.innerHTML = '<span style="color: #666;">Cargando datos...</span>';
    }
    
    // Cargar datos completos del usuario desde la API
    try {
        console.log('🔄 Fetching datos completos del usuario desde API con ID:', currentUserData.id);
        
        // Obtener el token de Supabase
        let accessToken = null;
        
        // Intentar obtener del sessionStorage primero
        const sessionStr = sessionStorage.getItem('supabase.auth.session');
        if (sessionStr) {
            try {
                const session = JSON.parse(sessionStr);
                accessToken = session.session?.access_token || session.access_token;
                console.log('✅ Token obtenido de sessionStorage');
            } catch (e) {
                console.warn('⚠️ No se pudo parsear sesión de sessionStorage:', e);
            }
        }
        
        // Si no hay en sessionStorage, intentar obtener de supabaseClient
        if (!accessToken && window.supabaseClient) {
            try {
                console.log('🔍 Intentando obtener token de supabaseClient...');
                const { data: { session }, error } = await window.supabaseClient.auth.getSession();
                if (session && session.access_token) {
                    accessToken = session.access_token;
                    console.log('✅ Token obtenido de supabaseClient.auth.getSession()');
                } else {
                    console.warn('⚠️ No hay sesión en supabaseClient:', error);
                }
            } catch (e) {
                console.warn('⚠️ Error obteniendo sesión de supabaseClient:', e);
            }
        }
        
        console.log('🔐 Token disponible:', !!accessToken);
        
        if (!accessToken) {
            throw new Error('No hay token de autenticación disponible');
        }
        
        // Usar el mismo endpoint que checkout.js: /api/get-user-data (POST)
        const response = await fetch('/api/get-user-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({})
        });
        
        console.log('📡 Response status:', response.status);
        console.log('📡 Response ok:', response.ok);
        
        const result = await response.json();
        console.log('✅ Respuesta JSON de la API:', JSON.stringify(result, null, 2));
        
        if (result.usuarioData) {
            const userData = result.usuarioData;
            console.log('📊 Datos completos del usuario desde API:', JSON.stringify(userData, null, 2));
            
            // Rellenar todos los campos con los datos de la API
            const nombreInput = document.getElementById('perfil-nombre');
            const apellidoInput = document.getElementById('perfil-apellido');
            const emailInput = document.getElementById('perfil-email');
            const telefonoInput = document.getElementById('perfil-telefono');
            const direccionInput = document.getElementById('perfil-direccion');
            const ciudadInput = document.getElementById('perfil-ciudad');
            const codigoPostalInput = document.getElementById('perfil-codigo-postal');
            const paisInput = document.getElementById('perfil-pais');
            
            console.log('🔍 Inputs encontrados:', {
                nombreInput: !!nombreInput,
                apellidoInput: !!apellidoInput,
                emailInput: !!emailInput,
                telefonoInput: !!telefonoInput,
                direccionInput: !!direccionInput,
                ciudadInput: !!ciudadInput,
                codigoPostalInput: !!codigoPostalInput,
                paisInput: !!paisInput
            });
            
            if (nombreInput) { nombreInput.value = userData.nombre || ''; console.log('✅ nombre establecido:', userData.nombre); }
            if (apellidoInput) { apellidoInput.value = userData.apellido || ''; console.log('✅ apellido establecido:', userData.apellido); }
            if (emailInput) { emailInput.value = userData.email || ''; console.log('✅ email establecido:', userData.email); }
            if (telefonoInput) { telefonoInput.value = userData.telefono || ''; console.log('✅ telefono establecido:', userData.telefono); }
            if (direccionInput) { direccionInput.value = userData.direccion || ''; console.log('✅ direccion establecido:', userData.direccion); }
            if (ciudadInput) { ciudadInput.value = userData.ciudad || ''; console.log('✅ ciudad establecido:', userData.ciudad); }
            if (codigoPostalInput) { codigoPostalInput.value = userData.codigo_postal || ''; console.log('✅ codigo_postal establecido:', userData.codigo_postal); }
            if (paisInput) { paisInput.value = userData.pais || 'España'; console.log('✅ pais establecido:', userData.pais); }
            
            console.log('✅ Todos los campos han sido rellenados desde la API');
            
            // Limpiar el mensaje de estado
            if (statusDiv) {
                statusDiv.innerHTML = '';
            }
        } else {
            console.warn('⚠️ API no devolvió usuarioData:', result);
            // Si la API falla, rellenar con los datos disponibles de localStorage
            fillFormWithLocalStorageData(currentUserData);
            if (statusDiv) {
                statusDiv.innerHTML = '';
            }
        }
    } catch (error) {
        console.error('❌ Error al obtener datos de la API:', error);
        console.error('❌ Error stack:', error.stack);
        // Si hay error en la API, rellenar con los datos disponibles de localStorage
        fillFormWithLocalStorageData(currentUserData);
        if (statusDiv) {
            statusDiv.innerHTML = '';
        }
    }
};

function fillFormWithLocalStorageData(userData) {
    console.log('📋 Rellenando formulario con datos de localStorage...');
    const nombreInput = document.getElementById('perfil-nombre');
    const apellidoInput = document.getElementById('perfil-apellido');
    const emailInput = document.getElementById('perfil-email');
    const telefonoInput = document.getElementById('perfil-telefono');
    const direccionInput = document.getElementById('perfil-direccion');
    const ciudadInput = document.getElementById('perfil-ciudad');
    const codigoPostalInput = document.getElementById('perfil-codigo-postal');
    const paisInput = document.getElementById('perfil-pais');
    
    if (nombreInput) nombreInput.value = userData.nombre || '';
    if (apellidoInput) apellidoInput.value = userData.apellido || '';
    if (emailInput) emailInput.value = userData.email || '';
    if (telefonoInput) telefonoInput.value = userData.telefono || '';
    if (direccionInput) direccionInput.value = userData.direccion || '';
    if (ciudadInput) ciudadInput.value = userData.ciudad || '';
    if (codigoPostalInput) codigoPostalInput.value = userData.codigo_postal || '';
    if (paisInput) paisInput.value = userData.pais || 'España';
    
    console.log('✅ Campos rellenados desde localStorage');
}

function createEditPerfilModal() {
    const modalHTML = `
    <div id="edit-perfil-modal" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); display: none; justify-content: center; align-items: center; z-index: 1000;">
        <div class="modal-content" style="background: linear-gradient(135deg, #f8f7f4 0%, #faf9f6 100%); padding: 40px; border-radius: 10px; box-shadow: 0 10px 50px rgba(0, 0, 0, 0.3); max-width: 600px; width: 90%; position: relative; border: 2px solid var(--color-principal);">
            <button class="btn-close-modal" onclick="closeEditPerfilModal()" type="button" style="position: absolute; right: 20px; top: 15px; background: none; border: none; font-size: 28px; cursor: pointer; color: #8B1538;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #8B1538; margin: 0; font-size: 24px;">Mi Perfil</h2>
                <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">Edita tu información personal</p>
            </div>

            <form id="edit-perfil-form" style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <label for="perfil-nombre" style="font-weight: 600; color: #333; display: block; margin-bottom: 6px;">Nombre *</label>
                        <input type="text" id="perfil-nombre" required style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
                    </div>
                    <div>
                        <label for="perfil-apellido" style="font-weight: 600; color: #333; display: block; margin-bottom: 6px;">Apellidos</label>
                        <input type="text" id="perfil-apellido" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
                    </div>
                </div>
                
                <div>
                    <label for="perfil-email" style="font-weight: 600; color: #333; display: block; margin-bottom: 6px;">Email *</label>
                    <input type="email" id="perfil-email" required readonly style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px; background-color: #f5f5f5; box-sizing: border-box;" />
                    <small style="color: #999; margin-top: 4px; display: block;">El email no puede ser modificado</small>
                </div>
                
                <div>
                    <label for="perfil-telefono" style="font-weight: 600; color: #333; display: block; margin-bottom: 6px;">Teléfono</label>
                    <input type="tel" id="perfil-telefono" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
                </div>
                
                <div>
                    <label for="perfil-direccion" style="font-weight: 600; color: #333; display: block; margin-bottom: 6px;">Dirección</label>
                    <input type="text" id="perfil-direccion" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
                </div>
                
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
                    <div>
                        <label for="perfil-ciudad" style="font-weight: 600; color: #333; display: block; margin-bottom: 6px;">Ciudad</label>
                        <input type="text" id="perfil-ciudad" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
                    </div>
                    <div>
                        <label for="perfil-codigo-postal" style="font-weight: 600; color: #333; display: block; margin-bottom: 6px;">Código Postal</label>
                        <input type="text" id="perfil-codigo-postal" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
                    </div>
                </div>
                
                <div>
                    <label for="perfil-pais" style="font-weight: 600; color: #333; display: block; margin-bottom: 6px;">País</label>
                    <input type="text" id="perfil-pais" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
                </div>
                
                <div id="perfil-status" style="margin-top: 16px; text-align: center;"></div>
                
                <div style="display: flex; gap: 12px; margin-top: 20px;">
                    <button type="submit" class="btn-principal" style="flex: 1; padding: 12px; background-color: #8B1538; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">Guardar Cambios</button>
                    <button type="button" onclick="closeEditPerfilModal()" style="flex: 1; padding: 12px; border: 2px solid #8B1538; background: transparent; color: #8B1538; border-radius: 6px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">Cancelar</button>
                </div>
            </form>
        </div>
    </div>
    `;
    
    // Agregar el modal al documento
    const body = document.body;
    body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Agregar event listener al formulario
    const form = document.getElementById('edit-perfil-form');
    if (form) {
        form.addEventListener('submit', handleSavePerfilForm);
    }
    
    // Agregar listener para cerrar con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeEditPerfilModal();
        }
    });
}

function closeEditPerfilModal() {
    const modal = document.getElementById('edit-perfil-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handleSavePerfilForm(e) {
    e.preventDefault();
    console.log('💾 Guardando cambios de perfil...');
    
    const modal = document.getElementById('edit-perfil-modal');
    const userId = modal.dataset.userId;
    
    const userData = {
        nombre: document.getElementById('perfil-nombre').value.trim(),
        apellido: document.getElementById('perfil-apellido').value.trim(),
        telefono: document.getElementById('perfil-telefono').value.trim(),
        direccion: document.getElementById('perfil-direccion').value.trim(),
        ciudad: document.getElementById('perfil-ciudad').value.trim(),
        codigo_postal: document.getElementById('perfil-codigo-postal').value.trim(),
        pais: document.getElementById('perfil-pais').value.trim()
    };
    
    // Validación
    if (!userData.nombre) {
        showPerfilStatus('error', 'El nombre es obligatorio');
        return;
    }
    
    const submitBtn = document.querySelector('#edit-perfil-form button[type="submit"]');
    const statusDiv = document.getElementById('perfil-status');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';
    }
    if (statusDiv) statusDiv.innerHTML = '<span style="color: #666;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; margin-right: 6px; vertical-align: middle; animation: spin 1s linear infinite;"><path d="M21.5 2v6h-6M2.5 22v-6h6"></path><path d="M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path></svg> Guardando...</span>';
    
    try {
        // Obtener el token de autenticación
        let accessToken = null;
        
        if (window.supabaseClient) {
            try {
                const { data: { session }, error } = await window.supabaseClient.auth.getSession();
                if (session && session.access_token) {
                    accessToken = session.access_token;
                    console.log('✅ Token obtenido de supabaseClient para guardar');
                }
            } catch (e) {
                console.warn('⚠️ Error obteniendo sesión:', e);
            }
        }
        
        console.log('🔐 Token disponible para guardar:', !!accessToken);
        
        const response = await fetch('/api/update-user-profile', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
            },
            body: JSON.stringify({ id: userId, ...userData })
        });
        
        const result = await response.json();
        console.log('📦 Response:', result);
        
        if (response.ok && result.success) {
            console.log('✅ Perfil actualizado exitosamente');
            
            // Actualizar currentUserData en window
            if (window.currentUserData) {
                window.currentUserData = { ...window.currentUserData, ...userData };
            }
            
            // Actualizar localStorage
            const currentUser = localStorage.getItem('currentUser');
            if (currentUser) {
                const updatedUser = { ...JSON.parse(currentUser), ...userData };
                localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            }
            
            showPerfilStatus('success', 'Cambios guardados correctamente');
            
            setTimeout(() => {
                closeEditPerfilModal();
                location.reload();
            }, 2000);
        } else {
            showPerfilStatus('error', result.error || 'Error al guardar los cambios');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        showPerfilStatus('error', 'Error de conexión');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Guardar Cambios';
        }
    }
}

function showPerfilStatus(type, message) {
    const statusDiv = document.getElementById('perfil-status');
    if (statusDiv) {
        if (type === 'success') {
            statusDiv.innerHTML = `<span style="color: #4CAF50; font-weight: 600;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; margin-right: 6px; vertical-align: middle;"><polyline points="20 6 9 17 4 12"></polyline></svg> ${message}</span>`;
        } else {
            statusDiv.innerHTML = `<span style="color: #ff4444;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; margin-right: 6px; vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> ${message}</span>`;
        }
    }
}
