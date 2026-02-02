// Script para manejar el formulario de contacto

console.log('✅ contact-form.js cargado');

// Esperar a que el elemento exista
function waitForContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        console.log('✅ Formulario encontrado, agregando event listener...');
        setupContactForm(contactForm);
    } else {
        console.log('⏳ Esperando form... reintentando en 500ms');
        setTimeout(waitForContactForm, 500);
    }
}

function setupContactForm(contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('📝 Formulario enviado');
        
        const nombre = document.getElementById('contact-nombre');
        const email = document.getElementById('contact-email');
        const asunto = document.getElementById('contact-asunto');
        const mensaje = document.getElementById('contact-mensaje');
        const statusDiv = document.getElementById('contact-status');
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        
        if (!nombre || !email || !asunto || !mensaje) {
            console.error('❌ Inputs no encontrados', { nombre: !!nombre, email: !!email, asunto: !!asunto, mensaje: !!mensaje });
            return;
        }
        
        const nombreVal = nombre.value.trim();
        const emailVal = email.value.trim();
        const asuntoVal = asunto.value.trim();
        const mensajeVal = mensaje.value.trim();
        
        console.log('Datos del formulario:', { nombreVal, emailVal, asuntoVal, mensajeVal: mensajeVal.substring(0, 50) });
        
        // Validar campos
        if (!nombreVal || !emailVal || !asuntoVal || !mensajeVal) {
            console.warn('❌ Campos incompletos');
            statusDiv.innerHTML = '<span style="color: #ff4444;">Por favor completa todos los campos</span>';
            return;
        }
        
        // Deshabilitar botón y mostrar estado
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        statusDiv.innerHTML = '<span style="color: #666;">Enviando mensaje...</span>';
        
        try {
            console.log('🚀 Enviando request a /api/send-contact');
            const response = await fetch('/api/send-contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nombre: nombreVal,
                    email: emailVal,
                    asunto: asuntoVal,
                    mensaje: mensajeVal
                })
            });
            
            console.log('📡 Response status:', response.status);
            const result = await response.json();
            console.log('📦 Response data:', result);
            
            if (response.ok && result.success) {
                console.log('✅ Mensaje enviado exitosamente');
                // Mostrar mensaje de éxito
                statusDiv.innerHTML = '<span style="color: #4CAF50; font-weight: 600;">Mensaje enviado correctamente. Nos pondremos en contacto pronto.</span>';
                
                // Limpiar formulario
                contactForm.reset();
                
                // Reestablecer botón después de 3 segundos
                setTimeout(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Enviar Mensaje';
                    statusDiv.innerHTML = '';
                }, 3000);
            } else {
                console.error('❌ Error en response:', result.error);
                statusDiv.innerHTML = `<span style="color: #ff4444;">Error: ${result.error || 'Error desconocido'}</span>`;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Mensaje';
            }
        } catch (error) {
            console.error('❌ Error en fetch:', error);
            statusDiv.innerHTML = '<span style="color: #ff4444;">Error al enviar el mensaje. Intenta de nuevo.</span>';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Mensaje';
        }
    });
}

// Iniciar cuando el documento esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForContactForm);
} else {
    waitForContactForm();
}
