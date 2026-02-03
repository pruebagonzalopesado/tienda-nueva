// Modal Global para Seleccionar Talla de Anillos

let tallaSeleccionadaGlobal = null;
let productoActualModal = null;
let sizesDisponiblesModal = [];

// Abrir modal para seleccionar talla
async function abrirModalSeleccionarTalla(producto) {
    productoActualModal = producto;
    tallaSeleccionadaGlobal = null;

    const modal = document.getElementById('modal-seleccionar-talla-global');
    const gridTallas = document.getElementById('modal-tallas-grid');
    
    if (!modal || !gridTallas) {
        console.error('Modal no encontrado');
        return;
    }

    // Obtener las tallas disponibles del producto
    try {
        // Si es desde la página de detalles, ya tenemos las tallas
        if (window.availableSizes && window.availableSizes.length > 0) {
            sizesDisponiblesModal = window.availableSizes;
        } else {
            // Si es desde otra página, necesitamos cargar las tallas desde la BD
            if (!window.supabaseClient) {
                console.error('Supabase no está disponible');
                return;
            }

            const { data: sizes, error } = await window.supabaseClient
                .from('ring_sizes')
                .select('size_number')
                .order('size_number', { ascending: true });

            if (error || !sizes) {
                console.error('Error cargando tallas:', error);
                return;
            }

            sizesDisponiblesModal = sizes.map(s => s.size_number);
        }

        // Limpiar grid de tallas
        gridTallas.innerHTML = '';

        // Crear botones de talla
        sizesDisponiblesModal.forEach(size => {
            const btn = document.createElement('button');
            btn.textContent = size;
            btn.style.cssText = `
                padding: 0.75rem 0.5rem;
                border: 2px solid #ddd;
                border-radius: 6px;
                background: white;
                color: #000;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s ease;
                font-size: 0.9rem;
            `;

            btn.addEventListener('click', () => {
                // Deseleccionar talla anterior
                const btnAnterior = gridTallas.querySelector('button.talla-seleccionada');
                if (btnAnterior) {
                    btnAnterior.classList.remove('talla-seleccionada');
                    btnAnterior.style.background = 'white';
                    btnAnterior.style.borderColor = '#ddd';
                    btnAnterior.style.color = '#000';
                }

                // Seleccionar nueva talla
                tallaSeleccionadaGlobal = size;
                btn.classList.add('talla-seleccionada');
                btn.style.background = '#d4af37';
                btn.style.borderColor = '#d4af37';
                btn.style.color = '#000';

                // Habilitar botón de agregar
                const btnAgregar = document.getElementById('btn-agregar-con-talla');
                if (btnAgregar) {
                    btnAgregar.disabled = false;
                    btnAgregar.style.opacity = '1';
                }

                // Limpiar input de diámetro
                const inputDiametro = document.getElementById('modal-input-diametro');
                if (inputDiametro) {
                    inputDiametro.value = '';
                }
            });

            btn.addEventListener('mouseenter', () => {
                if (!btn.classList.contains('talla-seleccionada')) {
                    btn.style.borderColor = '#d4af37';
                    btn.style.background = '#f9f6f3';
                }
            });

            btn.addEventListener('mouseleave', () => {
                if (!btn.classList.contains('talla-seleccionada')) {
                    btn.style.borderColor = '#ddd';
                    btn.style.background = 'white';
                }
            });

            gridTallas.appendChild(btn);
        });

        // Mostrar modal
        modal.style.display = 'flex';

        // Event listener para cerrar al hacer clic fuera
        modal.onclick = (e) => {
            if (e.target === modal) {
                cerrarModalSeleccionarTalla();
            }
        };

    } catch (error) {
        console.error('Error abriendo modal:', error);
    }
}

// Cerrar modal
function cerrarModalSeleccionarTalla() {
    const modal = document.getElementById('modal-seleccionar-talla-global');
    if (modal) {
        modal.style.display = 'none';
        tallaSeleccionadaGlobal = null;
        productoActualModal = null;
    }
    // 🛡️ Resetear flag si estaba en progreso
    window.agregarAlCarritoEnProceso = false;
}

// Calcular talla desde diámetro
async function calcularTallaModal() {
    const inputDiametro = document.getElementById('modal-input-diametro');
    const diametro = parseFloat(inputDiametro.value);

    if (!diametro || diametro <= 0) {
        notify.warning('Por favor ingresa un diámetro válido', 'Diámetro inválido', 3000);
        return;
    }

    try {
        if (!window.supabaseClient) {
            console.error('Supabase no está disponible');
            return;
        }

        // Obtener todas las tallas disponibles
        const { data: sizes, error } = await window.supabaseClient
            .from('ring_sizes')
            .select('size_number')
            .order('size_number', { ascending: true });

        if (error || !sizes) {
            console.error('Error obteniendo tallas:', error);
            return;
        }

        // Calcular talla estimada: diámetro (mm) - 0.5, redondeado
        // Esta es la fórmula estándar de anillos
        const tallaEstimada = Math.round(diametro - 0.5);

        // Encontrar la talla más cercana a la estimada
        let tallaMasCercana = sizes[0].size_number;
        let diferenciaMenor = Math.abs(sizes[0].size_number - tallaEstimada);

        for (let size of sizes) {
            const diferencia = Math.abs(size.size_number - tallaEstimada);
            if (diferencia < diferenciaMenor) {
                diferenciaMenor = diferencia;
                tallaMasCercana = size.size_number;
            }
        }

        // Seleccionar la talla
        const gridTallas = document.getElementById('modal-tallas-grid');
        const btns = gridTallas.querySelectorAll('button');

        btns.forEach(btn => {
            btn.classList.remove('talla-seleccionada');
            btn.style.background = 'white';
            btn.style.borderColor = '#ddd';
            btn.style.color = '#000';

            if (btn.textContent === tallaMasCercana) {
                btn.classList.add('talla-seleccionada');
                btn.style.background = '#d4af37';
                btn.style.borderColor = '#d4af37';
                btn.style.color = '#000';
            }
        });

        tallaSeleccionadaGlobal = tallaMasCercana;

        // Habilitar botón de agregar
        const btnAgregar = document.getElementById('btn-agregar-con-talla');
        if (btnAgregar) {
            btnAgregar.disabled = false;
            btnAgregar.style.opacity = '1';
        }

    } catch (error) {
        console.error('Error calculando talla:', error);
        notify.error('Error al calcular la talla. Intenta nuevamente', 'Error', 4000);
    }
}

// Agregar al carrito con talla seleccionada
function agregarAlCarritoConTalla() {
    // 🛡️ Protección contra múltiples clics
    if (window.agregarAlCarritoEnProceso) {
        console.warn('[agregarAlCarritoConTalla] Ya hay una operación en progreso, ignorando clic');
        return;
    }
    window.agregarAlCarritoEnProceso = true;
    
    if (!tallaSeleccionadaGlobal || !productoActualModal) {
        window.agregarAlCarritoEnProceso = false;
        mostrarModalAlerta('Talla Requerida', 'Por favor, selecciona una talla antes de agregar al carrito', 'info');
        return;
    }

    // Extraer imagen igual que en product-detail.js
    let imagenUrl = '';
    try {
        const imgs = Array.isArray(productoActualModal.imagen_url)
            ? productoActualModal.imagen_url
            : JSON.parse(productoActualModal.imagen_url || '[]');
        imagenUrl = imgs[0] || productoActualModal.imagen || '';
    } catch {
        imagenUrl = productoActualModal.imagen || '';
    }

    // Asegurar que el producto tiene las propiedades necesarias
    const producto = {
        id: productoActualModal.id,
        nombre: productoActualModal.nombre || 'Anillo',
        precio: productoActualModal.precio || 0,
        imagen: imagenUrl,
        talla: tallaSeleccionadaGlobal
    };

    // Validar stock con el servidor
    validarYAgregarAlCarritoConTalla(producto);
}

// Función para validar stock con servidor antes de agregar al carrito
async function validarYAgregarAlCarritoConTalla(producto) {
    try {
        const response = await fetch('/api/add-to-cart-validated', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: producto.id,
                cantidad: 1
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Stock insuficiente o error
            window.agregarAlCarritoEnProceso = false;
            mostrarAlertaStock(0, data.stockDisponible || 0, producto.nombre);
            return;
        }

        // Stock validado, agregar al carrito
        let carrito = JSON.parse(localStorage.getItem('carrito') || '[]');

        // Buscar si el producto con la misma talla ya existe
        const existe = carrito.find(i => i.id === producto.id && i.talla === producto.talla);

        if (existe) {
            existe.cantidad += 1;
        } else {
            carrito.push({ ...producto, cantidad: 1, tiempoAgregado: Date.now() });
        }

        // Guardar carrito
        localStorage.setItem('carrito', JSON.stringify(carrito));
        
        // 🔑 IMPORTANTE: Si es el primer item, guardar timestamp en sessionStorage
        if (carrito.length === 1 || !sessionStorage.getItem('carritoTimestamp')) {
            const ahora = Date.now();
            sessionStorage.setItem('carritoTimestamp', ahora.toString());
            window.carritoTimestamp = ahora;
        }

        // Actualizar contador
        if (typeof updateCartCount === 'function') {
            updateCartCount();
        }

        console.log('[agregarAlCarritoConTalla] ✅ Producto con talla agregado al carrito:', producto.nombre, producto.talla);
        
        // Actualizar stock en UI
        if (typeof window.actualizarStockDesdeModal === 'function' && producto?.id) {
            await window.actualizarStockDesdeModal(producto.id);
        }

        // 🔁 Forzar actualización inmediata del stock en otros usuarios
        if (typeof window.forzarActualizacionStock === 'function') {
            setTimeout(() => {
                window.forzarActualizacionStock();
            }, 100);
        }

        // Cerrar modal y mostrar éxito
        cerrarModalSeleccionarTalla();
        mostrarMensajeExitoTalla(`${producto.nombre} (Talla ${producto.talla}) agregado al carrito`);

        window.agregarAlCarritoEnProceso = false;

    } catch (error) {
        console.error('[validarYAgregarAlCarritoConTalla] Error:', error);
        window.agregarAlCarritoEnProceso = false;
        mostrarModalAlerta('Error', 'Error al validar stock. Intenta nuevamente.', 'error');
    }
}

// Mostrar mensaje de éxito en modal de talla
function mostrarMensajeExitoTalla(mensaje) {
    let exitoDiv = document.getElementById('exito-talla');
    if (!exitoDiv) {
        exitoDiv = document.createElement('div');
        exitoDiv.id = 'exito-talla';
        document.body.appendChild(exitoDiv);
    }

    exitoDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 400px;
        word-wrap: break-word;
        animation: slideInRight 0.3s ease;
    `;

    exitoDiv.textContent = mensaje;

    setTimeout(() => {
        exitoDiv.remove();
    }, 3000);
}

// Abrir carrito (función auxiliar)
function abrirCarritoDesdeModal() {
    if (typeof openCartSlide === 'function') {
        openCartSlide();
    }
}

// Mostrar mensaje de éxito
function mostrarMensajeExito(mensaje) {
    let sucessDiv = document.getElementById('exito-mensaje');
    if (!sucessDiv) {
        sucessDiv = document.createElement('div');
        sucessDiv.id = 'exito-mensaje';
        sucessDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #28a745;
            color: white;
            padding: 16px 24px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
            font-size: 14px;
            max-width: 400px;
        `;
        document.body.appendChild(sucessDiv);
    }

    sucessDiv.textContent = mensaje;
    sucessDiv.style.display = 'block';

    setTimeout(() => {
        sucessDiv.style.display = 'none';
    }, 3000);
}

// ========== ACTUALIZAR STOCK EN MODAL EN TIEMPO REAL ==========
// Sistema robusto de actualización de stock en el modal

// 1. Escuchar evento personalizado de carrito actualizado
window.addEventListener('carritoActualizado', function(event) {
    console.log('[modal-talla] Evento carritoActualizado recibido:', event.detail);
    actualizarStockDisponibleEnModal();
});

// 2. Monitorear cambios en localStorage (para esta pestaña - usando interval)
setInterval(() => {
    if (window._ultimoCarritoLocalModal !== localStorage.getItem('carrito')) {
        window._ultimoCarritoLocalModal = localStorage.getItem('carrito');
        console.log('[modal-talla] Cambio detectado en localStorage');
        actualizarStockDisponibleEnModal();
    }
}, 500); // Verificar cada 500ms

function actualizarStockDisponibleEnModal() {
    if (!productoActualModal) {
        console.log('[actualizarStockDisponibleEnModal] productoActualModal aún no está listo');
        return;
    }

    try {
        const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
        
        // Calcular cantidad del producto en carrito
        let cantidadEnCarrito = 0;
        for (let item of carrito) {
            if (item.id === productoActualModal.id) {
                cantidadEnCarrito += item.cantidad;
            }
        }

        // Stock disponible = stock original - cantidad en carrito
        const stockDisponible = (productoActualModal.stock || 0) - cantidadEnCarrito;
        
        console.log('[actualizarStockDisponibleEnModal] Producto:', productoActualModal.nombre, 'Stock Original:', productoActualModal.stock, 'En carrito:', cantidadEnCarrito, 'Disponible:', stockDisponible);

        // Actualizar elemento si existe
        const stockElement = document.getElementById('modal-stock-disponible');
        if (stockElement) {
            if (stockDisponible > 0) {
                stockElement.textContent = `${stockDisponible} unidades disponibles`;
                stockElement.className = 'stock-info available';
            } else {
                stockElement.textContent = 'Agotado';
                stockElement.className = 'stock-info out-of-stock';
            }
        }
    } catch (err) {
        console.error('[actualizarStockDisponibleEnModal] Error:', err);
    }
}
