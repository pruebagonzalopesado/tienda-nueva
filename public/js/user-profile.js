// Modal de edición de perfil de usuario
console.log('✅ user-profile.js cargado');

let editUserModalOpened = false;

window.openEditUserModal = function(userData) {
    console.log('📋 Abriendo modal de edición de usuario:', userData);
    
    // Crear el modal si no existe
    let modal = document.getElementById('edit-user-modal');
    if (!modal) {
        createEditUserModal();
        modal = document.getElementById('edit-user-modal');
    }
    
    // Llenar el formulario con los datos actuales
    if (document.getElementById('edit-nombre')) {
        document.getElementById('edit-nombre').value = userData.nombre || '';
    }
    if (document.getElementById('edit-apellido')) {
        document.getElementById('edit-apellido').value = userData.apellido || '';
    }
    if (document.getElementById('edit-email')) {
        document.getElementById('edit-email').value = userData.email || '';
    }
    if (document.getElementById('edit-telefono')) {
        document.getElementById('edit-telefono').value = userData.telefono || '';
    }
    if (document.getElementById('edit-direccion')) {
        document.getElementById('edit-direccion').value = userData.direccion || '';
    }
    if (document.getElementById('edit-ciudad')) {
        document.getElementById('edit-ciudad').value = userData.ciudad || '';
    }
    if (document.getElementById('edit-codigo-postal')) {
        document.getElementById('edit-codigo-postal').value = userData.codigo_postal || '';
    }
    
    // Guardar el ID del usuario para usarlo al guardar
    modal.dataset.userId = userData.id;
    
    // Mostrar el modal
    modal.style.display = 'flex';
    editUserModalOpened = true;
    
    // Cerrar el dropdown
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
};

function createEditUserModal() {
    const modalHTML = `
    <div id="edit-user-modal" class="modal" style="display: none;">
        <div class="modal-content user-profile-modal">
            <button class="btn-close-modal" onclick="closeEditUserModal()" type="button">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            
            <div style="text-align: center; margin-bottom: 30px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8B1538" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto; display: block; margin-bottom: 15px;">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <h2 style="color: #8B1538; margin: 0; font-size: 24px;">Mis Datos Personales</h2>
                <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">Edita tu información personal</p>
            </div>

            <form id="edit-user-form" style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label for="edit-nombre" style="font-weight: 600; color: #333;">Nombre *</label>
                        <input type="text" id="edit-nombre" required style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px;" />
                    </div>
                    <div class="form-group">
                        <label for="edit-apellido" style="font-weight: 600; color: #333;">Apellidos</label>
                        <input type="text" id="edit-apellido" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px;" />
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="edit-email" style="font-weight: 600; color: #333;">Email *</label>
                    <input type="email" id="edit-email" required readonly style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px; background-color: #f5f5f5;" />
                    <small style="color: #999; margin-top: 4px;">El email no puede ser modificado</small>
                </div>
                
                <div class="form-group">
                    <label for="edit-telefono" style="font-weight: 600; color: #333;">Teléfono</label>
                    <input type="tel" id="edit-telefono" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px;" />
                </div>
                
                <div class="form-group">
                    <label for="edit-direccion" style="font-weight: 600; color: #333;">Dirección</label>
                    <input type="text" id="edit-direccion" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px;" />
                </div>
                
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label for="edit-ciudad" style="font-weight: 600; color: #333;">Ciudad</label>
                        <input type="text" id="edit-ciudad" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px;" />
                    </div>
                    <div class="form-group">
                        <label for="edit-codigo-postal" style="font-weight: 600; color: #333;">Código Postal</label>
                        <input type="text" id="edit-codigo-postal" style="width: 100%; padding: 12px; border: 2px solid #d4af37; border-radius: 6px; font-size: 14px;" />
                    </div>
                </div>
                
                <div id="edit-user-status" style="margin-top: 16px; text-align: center;"></div>
                
                <div style="display: flex; gap: 12px; margin-top: 20px;">
                    <button type="submit" class="btn-principal" style="flex: 1;">Guardar Cambios</button>
                    <button type="button" onclick="closeEditUserModal()" class="btn-secundario" style="flex: 1; border: 2px solid #8B1538; background: transparent; color: #8B1538;">Cancelar</button>
                </div>
            </form>
        </div>
    </div>
    `;
    
    // Agregar el modal al documento
    const body = document.body;
    body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Agregar event listener al formulario
    const form = document.getElementById('edit-user-form');
    if (form) {
        form.addEventListener('submit', handleSaveUserProfile);
    }
    
    // Agregar listener para cerrar con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && editUserModalOpened) {
            closeEditUserModal();
        }
    });
}

function closeEditUserModal() {
    const modal = document.getElementById('edit-user-modal');
    if (modal) {
        modal.style.display = 'none';
        editUserModalOpened = false;
    }
}

async function handleSaveUserProfile(e) {
    e.preventDefault();
    console.log('💾 Guardando cambios de perfil...');
    
    const modal = document.getElementById('edit-user-modal');
    const userId = modal.dataset.userId;
    
    const userData = {
        nombre: document.getElementById('edit-nombre').value.trim(),
        apellido: document.getElementById('edit-apellido').value.trim(),
        telefono: document.getElementById('edit-telefono').value.trim(),
        direccion: document.getElementById('edit-direccion').value.trim(),
        ciudad: document.getElementById('edit-ciudad').value.trim(),
        codigo_postal: document.getElementById('edit-codigo-postal').value.trim()
    };
    
    // Validación
    if (!userData.nombre) {
        showProfileStatus('error', 'El nombre es obligatorio');
        return;
    }
    
    const submitBtn = document.querySelector('#edit-user-form button[type="submit"]');
    const statusDiv = document.getElementById('edit-user-status');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';
    }
    if (statusDiv) statusDiv.innerHTML = '<span style="color: #666;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; margin-right: 6px; vertical-align: middle; animation: spin 1s linear infinite;"><path d="M21.5 2v6h-6M2.5 22v-6h6"></path><path d="M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path></svg> Guardando...</span>';
    
    try {
        const response = await fetch('/api/update-user-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: userId, ...userData })
        });
        
        const result = await response.json();
        console.log('📦 Response:', result);
        
        if (response.ok && result.success) {
            console.log('✅ Perfil actualizado exitosamente');
            
            // Actualizar localStorage
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));
            const updatedUser = { ...currentUser, ...userData };
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            
            // Actualizar el nombre en el header
            document.getElementById('user-name').textContent = userData.nombre;
            
            showProfileStatus('success', 'Cambios guardados correctamente');
            
            setTimeout(() => {
                closeEditUserModal();
            }, 2000);
        } else {
            showProfileStatus('error', result.error || 'Error al guardar los cambios');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        showProfileStatus('error', 'Error de conexión');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Guardar Cambios';
        }
    }
}

function showProfileStatus(type, message) {
    const statusDiv = document.getElementById('edit-user-status');
    if (statusDiv) {
        if (type === 'success') {
            statusDiv.innerHTML = `<span style="color: #4CAF50; font-weight: 600;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; margin-right: 6px; vertical-align: middle;"><polyline points="20 6 9 17 4 12"></polyline></svg> ${message}</span>`;
        } else {
            statusDiv.innerHTML = `<span style="color: #ff4444;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline; margin-right: 6px; vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> ${message}</span>`;
        }
    }
}
