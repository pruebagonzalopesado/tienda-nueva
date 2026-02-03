// Categorías

let categoriaActual = '';
let productosActuales = [];
let subcategoriaSeleccionada = null;

// Cargar productos de la categoría
async function cargarCategoria() {
    const urlParams = new URLSearchParams(window.location.search);
    categoriaActual = urlParams.get('categoria') || 'Anillos';

    // Esperar a que Supabase esté listo
    let intentos = 0;
    while (!window.supabaseClient && intentos < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }

    if (!window.supabaseClient) {
        console.error('Supabase no se inicializó');
        return;
    }

    try {
        const { data: productos, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('categoria', categoriaActual)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error cargando productos:', error);
            return;
        }

        productosActuales = productos || [];

        // 🔄 Registrar productos para sincronización de stock en tiempo real
        if (typeof window.registrarProductosParaSync === 'function') {
            window.registrarProductosParaSync(productosActuales);
        }

        // Actualizar título
        const categoriaMap = {
            'Anillos': 'Anillos Exclusivos',
            'Collares': 'Collares Sofisticados',
            'Pendientes': 'Pendientes Elegantes',
            'Pulseras': 'Pulseras de Diseño'
        };

        document.getElementById('categoria-titulo').textContent = categoriaMap[categoriaActual] || categoriaActual;
        document.getElementById('categoria-desc').textContent = `Descubre nuestra colección de ${categoriaActual.toLowerCase()}`;

        // Cargar subcategorías
        cargarSubcategorias();
        
        renderizarProductos(productosActuales);
        updateCartCount();

    } catch (err) {
        console.error('Error:', err);
    }
}

// Cargar y mostrar subcategorías
async function cargarSubcategorias() {
    const contenedor = document.getElementById('filtro-subcategoria');
    if (!contenedor) return;
    
    contenedor.innerHTML = '';
    
    // Relojes no tiene subcategorías
    if (categoriaActual === 'Relojes') {
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('subcategorias')
            .select('id, nombre')
            .eq('categoria', categoriaActual)
            .order('nombre', { ascending: true });
        
        if (error) {
            console.error('Error cargando subcategorías:', error);
            return;
        }
        
        if (data && data.length > 0) {
            // Botón "Ver Todos"
            const btnTodos = document.createElement('button');
            btnTodos.className = 'subcategoria-btn active';
            btnTodos.textContent = 'Ver Todos';
            btnTodos.onclick = () => {
                subcategoriaSeleccionada = null;
                document.querySelectorAll('.subcategoria-btn').forEach(b => b.classList.remove('active'));
                btnTodos.classList.add('active');
                filtrarPorSubcategoria();
            };
            contenedor.appendChild(btnTodos);
            
            // Botones de subcategorías
            data.forEach(sub => {
                const btn = document.createElement('button');
                btn.className = 'subcategoria-btn';
                btn.textContent = sub.nombre;
                btn.onclick = () => {
                    subcategoriaSeleccionada = sub.id;
                    document.querySelectorAll('.subcategoria-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    filtrarPorSubcategoria();
                };
                contenedor.appendChild(btn);
            });
        }
    } catch (err) {
        console.error('Error cargando subcategorías:', err);
    }
}

// Filtrar productos por subcategoría
function filtrarPorSubcategoria() {
    let productosFiltrados = productosActuales;
    
    if (subcategoriaSeleccionada) {
        productosFiltrados = productosActuales.filter(p => p.subcategoria_id === subcategoriaSeleccionada);
    }
    
    renderizarProductos(productosFiltrados);
}

// Renderizar productos
function renderizarProductos(productos) {
    const grid = document.getElementById('productos-grid');
    const sinProductos = document.getElementById('sin-productos');

    if (productos.length === 0) {
        grid.style.display = 'none';
        sinProductos.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    sinProductos.style.display = 'none';
    grid.innerHTML = '';

    productos.forEach(producto => {
        // Obtener primera imagen
        let imagenURL = '';
        try {
            const imagenes = Array.isArray(producto.imagen_url)
                ? producto.imagen_url
                : JSON.parse(producto.imagen_url || '[]');
            imagenURL = imagenes[0] || '';
        } catch (e) { }

        const card = document.createElement('div');
        card.className = 'producto-card';

        const etiqueta = producto.etiqueta ? `<div class="producto-etiqueta">${producto.etiqueta}</div>` : '';
        const badgeOferta = producto.descuento_oferta && producto.descuento_oferta > 0
            ? `<div class="oferta-badge">-${producto.descuento_oferta}%</div>`
            : '';

        // Calcular precio con descuento si existe
        let precioHTML = `<div class="producto-precio">€${parseFloat(producto.precio).toFixed(2)}</div>`;
        if (producto.descuento_oferta && producto.descuento_oferta > 0) {
            const precioConDescuento = producto.precio * (1 - producto.descuento_oferta / 100);
            precioHTML = `
                <div class="producto-precio">
                    <span style="text-decoration: line-through;color: #888;font-size:0.85em;">€${parseFloat(producto.precio).toFixed(2)}</span>
                    <span style="font-weight: bold;color: #d4af37;font-size:1.1em;">€${precioConDescuento.toFixed(2)}</span>
                </div>
            `;
        }

        // Determinar si hay stock
        const hayStock = producto.stock > 0;
        const stockClass = hayStock ? '' : 'sin-stock';
        const btnDisabled = hayStock ? '' : 'disabled';
        const btnText = hayStock ? 'Agregar' : 'Sin stock';

        card.innerHTML = `
            ${etiqueta}
            ${badgeOferta}
            <div class="producto-imagen" style="${!hayStock ? 'opacity: 0.5;' : ''}">
                ${imagenURL ? `<img src="${imagenURL}" alt="${producto.nombre}">` : '<div class="producto-imagen-vacia">💎</div>'}
            </div>
            ${!hayStock ? '<div class="stock-indicator">Sin stock</div>' : ''}
            <div class="producto-content">
                <div class="producto-nombre">${producto.nombre}</div>
                ${precioHTML}
                <div class="producto-acciones">
                    <button class="btn-ver-detalle" onclick="window.location.href='/productos/${producto.id}'">Ver Detalle</button>
                    <button class="btn-carrito ${stockClass}" onclick="agregarAlCarrito({id: ${producto.id}, nombre: '${producto.nombre.replace(/'/g, "\\'")}', precio: ${producto.precio}, imagen: '${imagenURL.replace(/'/g, "\\'")}'});" ${btnDisabled}>${btnText}</button>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// Aplicar filtros
function aplicarFiltros() {
    const filtro = document.getElementById('filtro-precio').value;
    let productosOrdenados = [...productosActuales];

    switch (filtro) {
        case 'precio-asc':
            productosOrdenados.sort((a, b) => a.precio - b.precio);
            break;
        case 'precio-desc':
            productosOrdenados.sort((a, b) => b.precio - a.precio);
            break;
        case 'nombre':
            productosOrdenados.sort((a, b) => a.nombre.localeCompare(b.nombre));
            break;
        case 'nuevo':
        default:
            productosOrdenados.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    renderizarProductos(productosOrdenados);
}

// Función global para agregar al carrito
window.agregarAlCarrito = function (producto) {
    // Verificar si el producto tiene stock en BD (verificación local primero)
    const productoEnBD = productosActuales.find(p => p.id === producto.id);
    if (!productoEnBD) {
        mostrarMensajeErrorStock('Producto no encontrado');
        return;
    }

    // Si es un anillo, mostrar modal para seleccionar talla
    if (productoEnBD.categoria === 'Anillos') {
        abrirModalSeleccionarTalla(productoEnBD);
        return;
    }

    // Validar con el servidor para evitar race conditions
    validarYAgregarAlCarrito(producto);
};

// Función para validar stock con el servidor
async function validarYAgregarAlCarrito(producto) {
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
            mostrarMensajeErrorStock(data.error || 'Error al agregar al carrito');
            
            // Actualizar el stock en la UI si es necesario
            if (data.stockDisponible >= 0) {
                const productoEnBD = productosActuales.find(p => p.id === producto.id);
                if (productoEnBD) {
                    productoEnBD.stock = data.stockDisponible;
                    renderizarProductos(productosActuales);
                }
            }
            return;
        }

        // Stock validado correctamente, agregar al carrito local
        let cart = JSON.parse(localStorage.getItem('carrito') || '[]');

        const item = {
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: 1,
            imagen: producto.imagen || '',
            tiempoAgregado: Date.now()
        };

        const existingItem = cart.find(i => i.id === item.id);
        
        if (existingItem) {
            existingItem.cantidad += 1;
        } else {
            cart.push(item);
        }

        localStorage.setItem('carrito', JSON.stringify(cart));
        updateCartCount();

        // Actualizar stock en la UI
        const productoEnBD = productosActuales.find(p => p.id === producto.id);
        if (productoEnBD) {
            productoEnBD.stock = data.producto.stockDisponible;
            renderizarProductos(productosActuales);
        }

        // 🔁 Forzar actualización inmediata del stock en otros usuarios
        if (typeof window.forzarActualizacionStock === 'function') {
            setTimeout(() => {
                window.forzarActualizacionStock();
            }, 100);
        }

        console.log('[agregarAlCarrito] ✅', data.mensaje);
        mostrarMensajeExito(data.mensaje);

    } catch (error) {
        console.error('[validarYAgregarAlCarrito] Error:', error);
        mostrarMensajeErrorStock('Error al validar stock. Intenta nuevamente.');
    }
}

// Mostrar mensaje de éxito
function mostrarMensajeExito(mensaje) {
    let exitoDiv = document.getElementById('exito-stock-categorias');
    if (!exitoDiv) {
        exitoDiv = document.createElement('div');
        exitoDiv.id = 'exito-stock-categorias';
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

// Mostrar mensaje de error de stock
function mostrarMensajeErrorStock(mensaje) {
    // Crear contenedor del mensaje si no existe
    let errorDiv = document.getElementById('error-stock-categorias');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-stock-categorias';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #c00;
            color: white;
            padding: 16px 24px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
            font-size: 14px;
            max-width: 400px;
        `;
        document.body.appendChild(errorDiv);
    }
    
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}

// Actualizar contador del carrito
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('carrito') || '[]');
    const total = cart.reduce((sum, item) => sum + item.cantidad, 0);
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        cartCountEl.textContent = total;
    }
}

// Login modal
window.openLoginModal = function () {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeLoginModal = function () {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('login-form');
    if (form) form.reset();
};

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        cargarCategoria();
    }, 500);
});
