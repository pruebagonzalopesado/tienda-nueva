/**
 * Sistema de Notificaciones Profesional
 * Reemplaza los alert() por toasts elegantes
 */

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
    }

    init() {
        // Crear contenedor si no existe
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
            this.container = container;
        } else {
            this.container = document.getElementById('notification-container');
        }

        // Inyectar estilos
        this.injectStyles();
    }

    injectStyles() {
        const styleId = 'notification-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .notification-container {
                    position: fixed;
                    top: 30px;
                    right: 30px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    pointer-events: none;
                }

                .notification {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 16px 20px;
                    border-radius: 8px;
                    background: white;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                    animation: slideInRight 0.4s ease-out;
                    pointer-events: all;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    max-width: 400px;
                    min-width: 300px;
                    border-left: 4px solid;
                    position: relative;
                    overflow: hidden;
                }

                @keyframes slideInRight {
                    from {
                        transform: translateX(450px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }

                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(450px);
                        opacity: 0;
                    }
                }

                .notification.removing {
                    animation: slideOutRight 0.4s ease-out forwards;
                }

                /* Tipo: Éxito */
                .notification.success {
                    border-left-color: #22c55e;
                }

                .notification.success .notification-icon {
                    color: #22c55e;
                    font-size: 20px;
                }

                .notification.success .progress-bar {
                    background: #22c55e;
                }

                /* Tipo: Error */
                .notification.error {
                    border-left-color: #ef4444;
                }

                .notification.error .notification-icon {
                    color: #ef4444;
                    font-size: 20px;
                }

                .notification.error .progress-bar {
                    background: #ef4444;
                }

                /* Tipo: Advertencia */
                .notification.warning {
                    border-left-color: #f59e0b;
                }

                .notification.warning .notification-icon {
                    color: #f59e0b;
                    font-size: 20px;
                }

                .notification.warning .progress-bar {
                    background: #f59e0b;
                }

                /* Tipo: Info */
                .notification.info {
                    border-left-color: #3b82f6;
                }

                .notification.info .notification-icon {
                    color: #3b82f6;
                    font-size: 20px;
                }

                .notification.info .progress-bar {
                    background: #3b82f6;
                }

                .notification-icon {
                    font-weight: bold;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                }

                .notification-content {
                    flex: 1;
                    color: #333;
                    line-height: 1.4;
                }

                .notification-title {
                    font-weight: 600;
                    margin-bottom: 2px;
                }

                .notification-message {
                    font-size: 13px;
                    opacity: 0.8;
                    margin: 0;
                }

                .notification-close {
                    background: none;
                    border: none;
                    color: #999;
                    cursor: pointer;
                    padding: 4px 8px;
                    font-size: 18px;
                    flex-shrink: 0;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .notification-close:hover {
                    color: #333;
                }

                .progress-bar {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    animation: progress 5s linear forwards;
                }

                @keyframes progress {
                    from {
                        width: 100%;
                    }
                    to {
                        width: 0%;
                    }
                }

                /* Versión compacta */
                .notification.compact {
                    padding: 12px 16px;
                    min-width: 250px;
                    font-size: 13px;
                }

                .notification.compact .notification-content {
                    text-align: center;
                }

                /* Tema Galiana (dorado y burgundy) */
                .notification.galiana-success {
                    border-left-color: #d4af37;
                    background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%);
                }

                .notification.galiana-success .notification-icon {
                    color: #d4af37;
                }

                .notification.galiana-success .progress-bar {
                    background: #d4af37;
                }

                .notification.galiana-error {
                    border-left-color: #6B1C23;
                    background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%);
                }

                .notification.galiana-error .notification-icon {
                    color: #6B1C23;
                }

                .notification.galiana-error .progress-bar {
                    background: #6B1C23;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .notification-container {
                        top: 20px;
                        right: 15px;
                        left: 15px;
                    }

                    .notification {
                        min-width: auto;
                        max-width: 100%;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    show(message, type = 'info', title = '', duration = 5000) {
        const notificationId = `notification-${Date.now()}-${Math.random()}`;
        
        // Mapear tipo a icono
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const notification = document.createElement('div');
        notification.id = notificationId;
        notification.className = `notification ${type}`;

        // Determinar título automático si no se proporciona
        if (!title) {
            const titles = {
                success: 'Éxito',
                error: 'Error',
                warning: 'Atención',
                info: 'Información'
            };
            title = titles[type] || 'Notificación';
        }

        notification.innerHTML = `
            <div class="notification-icon">${icons[type]}</div>
            <div class="notification-content">
                ${title ? `<div class="notification-title">${title}</div>` : ''}
                <p class="notification-message">${message}</p>
            </div>
            <button class="notification-close">×</button>
            <div class="progress-bar"></div>
        `;

        this.container.appendChild(notification);

        // Event listener para botón cerrar
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.remove(notificationId);
        });

        // Auto-remover después de duración
        const timeoutId = setTimeout(() => {
            this.remove(notificationId);
        }, duration);

        // Guardar referencia
        const notifObj = { id: notificationId, element: notification, timeoutId };
        this.notifications.push(notifObj);

        return notificationId;
    }

    success(message, title = 'Éxito', duration = 4000) {
        return this.show(message, 'success', title, duration);
    }

    error(message, title = 'Error', duration = 5000) {
        return this.show(message, 'error', title, duration);
    }

    warning(message, title = 'Atención', duration = 4500) {
        return this.show(message, 'warning', title, duration);
    }

    info(message, title = 'Información', duration = 4000) {
        return this.show(message, 'info', title, duration);
    }

    remove(notificationId) {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
            const notif = this.notifications[index];
            clearTimeout(notif.timeoutId);
            notif.element.classList.add('removing');
            
            setTimeout(() => {
                notif.element.remove();
                this.notifications.splice(index, 1);
            }, 400);
        }
    }

    clear() {
        this.notifications.forEach(notif => {
            clearTimeout(notif.timeoutId);
            notif.element.remove();
        });
        this.notifications = [];
    }
}

// Instanciar globalmente
window.notify = new NotificationSystem();

// Alias para compatibilidad
window.showNotification = window.notify.show.bind(window.notify);
