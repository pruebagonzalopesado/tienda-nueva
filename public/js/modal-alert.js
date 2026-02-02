/**
 * Modal de Alerta Profesional
 * Reemplaza los alert() nativos con un modal elegante y personalizable
 */

function mostrarModalAlerta(titulo, mensaje, tipo = 'error', onClose = null) {
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-alert-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.3s ease;
    `;

    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'modal-alert';
    
    // Determinar color según tipo
    let colorBorde = '#d4464e'; // Por defecto rojo para error
    
    if (tipo === 'error') {
        colorBorde = '#d4464e';
    } else if (tipo === 'success') {
        colorBorde = '#28a745';
    } else if (tipo === 'info') {
        colorBorde = '#17a2b8';
    }
    
    modal.style.cssText = `
        background: white;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        max-width: 450px;
        width: 90%;
        padding: 0;
        overflow: hidden;
        animation: slideUp 0.3s ease;
        border-left: 4px solid ${colorBorde};
    `;

    modal.innerHTML = `
        <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
            <h2 style="margin: 0; color: #333; font-size: 1.2rem; font-weight: 600;">${titulo}</h2>
            <p style="color: #666; font-size: 0.95rem; line-height: 1.5; margin: 0; white-space: pre-line;">${mensaje}</p>
            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;">
                <button class="btn-modal-close" style="
                    padding: 10px 24px;
                    background: #f5f5f5;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                    color: #333;
                    transition: all 0.3s;
                    font-size: 0.95rem;
                ">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Eventos de cierre
    const btnCerrar = modal.querySelector('.btn-modal-close');
    
    const cerrarModal = () => {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            overlay.remove();
            if (onClose && typeof onClose === 'function') {
                onClose();
            }
        }, 300);
    };

    btnCerrar.addEventListener('click', cerrarModal);
    btnCerrar.addEventListener('mouseenter', function() {
        this.style.background = '#ececec';
        this.style.borderColor = '#d0d0d0';
    });
    btnCerrar.addEventListener('mouseleave', function() {
        this.style.background = '#f5f5f5';
        this.style.borderColor = '#e0e0e0';
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            cerrarModal();
        }
    });

    // Permitir cerrar con Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            cerrarModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    return overlay;
}

// Función específica para alertas de stock
function mostrarAlertaStock(cantidadEnCarrito, stockDisponible, nombreProducto = '') {
    let titulo = 'Stock Insuficiente';
    let mensaje = `No hay suficiente stock disponible.`;
    
    if (cantidadEnCarrito > 0) {
        mensaje += `\n\nYa tienes ${cantidadEnCarrito} en el carrito.`;
    }
    
    mensaje += `\nStock disponible: ${stockDisponible}`;
    
    if (nombreProducto) {
        titulo = `${nombreProducto}`;
    }
    
    mostrarModalAlerta(titulo, mensaje, 'error');
}

// Agregar estilos de animación al documento
if (!document.querySelector('style[data-modal-alert]')) {
    const style = document.createElement('style');
    style.setAttribute('data-modal-alert', 'true');
    style.textContent = `
        @keyframes fadeIn {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }
        
        @keyframes fadeOut {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }
        
        @keyframes slideUp {
            from {
                transform: translateY(20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
}
