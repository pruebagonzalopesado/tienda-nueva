// ========== MOBILE MENU TOGGLE ==========
function toggleMobileMenu() {
    const navMenu = document.getElementById('nav-menu');
    const hamburger = document.getElementById('hamburger');

    if (navMenu) {
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
    }
}

// Cerrar menú móvil cuando se hace clic en un enlace
document.addEventListener('DOMContentLoaded', function () {
    const navLinks = document.querySelectorAll('.nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function () {
            const navMenu = document.getElementById('nav-menu');
            const hamburger = document.getElementById('hamburger');
            if (navMenu) {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            }
        });
    });
});

// Variables globales
let allProductosPage = [];
let filtroActivoPage = 'Todos';
let subcategoriaSeleccionada = null;
let categoriaActualPagina = null;
let ordenamientoActual = 'relevancia';

// Cargar productos
async function cargarProductosPagina() {
    // Esperar a que Supabase esté completamente listo
    let intentos = 0;
    while (!window.supabaseClient && intentos < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }

    if (!window.supabaseClient) {
        console.error('Supabase no se inicializó');
        return;
    }

    const { data: productos, error } = await window.supabaseClient
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al cargar productos:', error);
        return;
    }

    // Cargar TODOS los productos (incluyendo sin stock)
    allProductosPage = (productos || []);
    console.log('Productos cargados:', allProductosPage.length);
    console.log('Primer producto:', allProductosPage[0]);

    // Obtener categoría de la URL
    const urlParams = new URLSearchParams(window.location.search);
    let categoria = urlParams.get('categoria');

    // Si no hay parámetro de búsqueda, intentar obtener del path (ej: /categoria/Anillos)
    if (!categoria) {
        const pathParts = window.location.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart !== '' && lastPart !== 'productos') {
            categoria = decodeURIComponent(lastPart);
        }
    }

    if (categoria) {
        filtroActivoPage = categoria;
        categoriaActualPagina = categoria;
        
        // Actualizar el select de categoría
        const catSelect = document.getElementById('filtro-categoria');
        if (catSelect) {
            catSelect.value = categoria;
        }
        
        // Cargar subcategorías (CON AWAIT)
        await cargarSubcategoriasProductos(categoria);
        // Filtrar productos por categoría
        const productosFiltrados = allProductosPage.filter(p => p.categoria === categoria);
        mostrarProductos(productosFiltrados);
    } else {
        // Categoría por defecto: Todos
        filtroActivoPage = 'Todos';
        
        // Actualizar el select de categoría
        const catSelect = document.getElementById('filtro-categoria');
        if (catSelect) {
            catSelect.value = 'Todos';
        }
        
        // Limpiar subcategorías
        limpiarSubcategorias();
        mostrarProductos(allProductosPage);
    }
}

// Mostrar productos
function mostrarProductos(productos) {
    const grid = document.querySelector('.productos-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!productos || productos.length === 0) {
        grid.innerHTML = '<p style="text-align:center;grid-column:1/-1;padding:40px;">No hay productos disponibles</p>';
        return;
    }

    productos.forEach(producto => {
        const precioFinal = producto.descuento_oferta > 0
            ? producto.precio * (1 - producto.descuento_oferta / 100)
            : producto.precio;

        const card = document.createElement('div');
        card.className = 'producto-card';

        let imagenUrl = 'https://via.placeholder.com/250x200?text=Producto';
        if (producto.imagen_url) {
            console.log('Procesando imagen para:', producto.nombre, 'URL:', producto.imagen_url);
            try {
                const imagenes = JSON.parse(producto.imagen_url);
                console.log('Imágenes parseadas:', imagenes);
                if (Array.isArray(imagenes) && imagenes.length > 0) {
                    imagenUrl = imagenes[0];
                } else if (typeof imagenes === 'string') {
                    imagenUrl = imagenes;
                }
            } catch (e) {
                console.log('Error parseando JSON, intentando URL directa:', e);
                // Si no es JSON, intenta como URL directa
                if (producto.imagen_url.startsWith('http')) {
                    imagenUrl = producto.imagen_url;
                }
            }
            console.log('URL final de imagen:', imagenUrl);
        }

        const badgeOferta = producto.descuento_oferta && producto.descuento_oferta > 0
            ? `<div class="oferta-badge">-${producto.descuento_oferta}%</div>`
            : '';


        let precioHtml = `€${producto.precio.toFixed(2)}`;
        if (producto.descuento_oferta > 0) {
            precioHtml = `
                <span style="text-decoration: line-through;color: #888;font-size:0.85em;">€${producto.precio.toFixed(2)}</span>
                <span style="font-weight:bold;color:#d4af37;font-size:1.1em;">€${precioFinal.toFixed(2)}</span>
            `;
        }

        // Determinar si hay stock
        const hayStock = producto.stock > 0;
        const stockClass = hayStock ? '' : 'sin-stock';
        const btnDisabled = hayStock ? '' : 'disabled';
        const btnText = hayStock ? 'Agregar al carrito' : 'Sin stock';

        card.innerHTML = `
            ${badgeOferta}
            <img src="${imagenUrl}" alt="${producto.nombre}" style="width:100%;height:200px;object-fit:cover;${!hayStock ? 'opacity: 0.5;' : ''}">
            ${!hayStock ? '<div class="stock-indicator">Sin stock</div>' : ''}
            <h3>${producto.nombre}</h3>
            <div class="precio">${precioHtml}</div>
            <button class="btn-agregar ${stockClass}" data-producto-id="${producto.id}" data-producto-nombre="${producto.nombre}" data-producto-precio="${precioFinal}" data-producto-imagen="${imagenUrl}" style="pointer-events: auto;" ${btnDisabled}>${btnText}</button>
        `;

        card.style.cursor = 'pointer';

        // Click en el botón de agregar
        const btnAgregar = card.querySelector('.btn-agregar');
        if (btnAgregar && hayStock) {
            btnAgregar.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();

                const item = {
                    id: parseInt(this.dataset.productoId),
                    nombre: this.dataset.productoNombre,
                    precio: parseFloat(this.dataset.productoPrecio),
                    imagen: this.dataset.productoImagen
                };

                agregarAlCarritoProductos(e, item);
                return false;
            });
        }

        // Click en el resto de la tarjeta
        card.addEventListener('click', function (e) {
            // Si el click fue en el botón, no navegar
            if (e.target.classList.contains('btn-agregar') || e.target.closest('.btn-agregar')) {
                return;
            }
            window.location.href = `/productos/${producto.id}`;
        });

        grid.appendChild(card);
    });

    updateCartCount();
}

// Agregar al carrito
function agregarAlCarritoProductos(event, item) {
    // 🛡️ Protección contra múltiples clics
    if (window.agregarAlCarritoEnProceso) {
        console.warn('[agregarAlCarritoProductos] Ya hay una operación en progreso, ignorando clic');
        return;
    }
    window.agregarAlCarritoEnProceso = true;
    
    // Prevenir que el evento propague al contenedor de la tarjeta
    if (event) {
        event.stopPropagation();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    console.log('agregarAlCarritoProductos:', item);

    // Buscar el producto en la lista para verificar stock y categoría
    const producto = allProductosPage.find(p => p.id === item.id);
    if (!producto || producto.stock <= 0) {
        // Mostrar mensaje de error
        window.agregarAlCarritoEnProceso = false;
        mostrarMensajeErrorStock('Lo siento, este producto no tiene stock disponible en este momento.');
        return;
    }

    // Si es un anillo, mostrar modal para seleccionar talla
    if (producto.categoria === 'Anillos') {
        window.agregarAlCarritoEnProceso = false;
        abrirModalSeleccionarTalla(producto);
        return;
    }

    // SIEMPRE leer del localStorage para sincronizar con otros contextos
    let carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    console.log('[agregarAlCarritoProductos] carrito desde localStorage:', carrito.map(i => ({ id: i.id, nombre: i.nombre, cantidad: i.cantidad })));

    const existe = carrito.find(i => i.id === item.id);
    
    // NUEVA VALIDACIÓN: Verificar que la cantidad total no supere el stock
    let cantidadEnCarrito = existe ? existe.cantidad : 0;
    let cantidadTotal = cantidadEnCarrito + 1;
    
    if (cantidadTotal > producto.stock) {
        window.agregarAlCarritoEnProceso = false;
        const stockDisponible = producto.stock - cantidadEnCarrito;
        mostrarMensajeErrorStock(`No hay suficiente stock disponible.\n\nYa tienes ${cantidadEnCarrito} en el carrito.\nStock disponible: ${stockDisponible}`);
        return;
    }

    if (existe) {
        existe.cantidad += 1;
        console.log('[agregarAlCarritoProductos] Producto existente (id:', existe.id, '), actualizando cantidad a:', existe.cantidad);
    } else {
        carrito.push({ ...item, cantidad: 1, tiempoAgregado: Date.now() });
        console.log('[agregarAlCarritoProductos] Producto nuevo (id:', item.id, ') añadido');
    }

    // Actualizar localStorage y window.carrito
    localStorage.setItem('carrito', JSON.stringify(carrito));
    window.carrito = carrito;
    console.log('localStorage y window.carrito actualizados:', carrito);
    
    // Restar stock de la base de datos
    if (window.supabaseClient) {
        fetch('/api/update-cart-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: item.id,
                cantidad: 1,
                accion: 'restar'
            })
        })
        .then(res => {
            if (!res.ok) {
                console.warn('[productos agregarAlCarrito] API error:', res.status);
                return null;
            }
            return res.json();
        })
        .then(data => {
            if (data?.success) {
                console.log('[productos agregarAlCarrito] Stock actualizado:', data);
            }
        })
        .catch(err => console.warn('[productos agregarAlCarrito] Error actualizando stock:', err));
    }

    // Abrir slide-over del carrito con delay
    if (typeof openCartSlide === 'function') {
        console.log('Intentando abrir carrito slide...');
        setTimeout(() => {
            try {
                openCartSlide();
                console.log('Carrito slide abierto exitosamente');
            } catch (e) {
                console.error('Error al abrir carrito slide:', e);
            }
        }, 100);
    } else {
        console.warn('openCartSlide no está disponible');
    }

    // Actualizar contador del carrito
    if (typeof updateCartCount === 'function') {
        updateCartCount();
    }

    // ❌ Carrito NO se guarda en BD - solo en localStorage

    // Recalcular totales si la función existe
    if (typeof window.calcularTotales === 'function') {
        console.log('Recalculando totales');
        console.log('Carrito actual para calcularTotales:', window.carrito);
        window.calcularTotales();
    } else {
        console.warn('calcularTotales no está disponible');
    }

    updateCartCount();
    
    // 🛡️ Resetear flag de protección
    window.agregarAlCarritoEnProceso = false;
}

// Mostrar mensaje de error de stock
function mostrarMensajeErrorStock(mensaje) {
    // Crear contenedor del mensaje si no existe
    let errorDiv = document.getElementById('error-stock-productos');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-stock-productos';
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

// Actualizar contador
function updateCartCount() {
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    const count = carrito.reduce((total, item) => total + item.cantidad, 0);
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        cartCountEl.textContent = count;
    }
}

// Aplicar filtro

async function cargarSubcategoriasProductos(categoria) {
    const wrapper = document.getElementById('subcategoria-wrapper');
    const select = document.getElementById('filtro-subcategoria');
    
    if (!wrapper || !select) {
        return;
    }

    // Relojes y Medallas no tienen subcategorías
    const dividerSubcat = document.querySelector('.filtro-divider-subcat');
    if (categoria === 'Relojes' || categoria === 'Medallas' || categoria === 'Todos' || categoria === 'Ofertas') {
        wrapper.style.display = 'none';
        if (dividerSubcat) dividerSubcat.style.display = 'none';
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('subcategorias')
            .select('id, nombre')
            .ilike('categoria', categoria)
            .order('nombre', { ascending: true });

        if (error) {
            console.error('Error cargando subcategorías:', error);
            wrapper.style.display = 'none';
            return;
        }

        if (data && data.length > 0) {
            // Limpiar opciones excepto la primera
            select.innerHTML = '<option value="">Ver Todos</option>';
            
            // Agregar opciones de subcategorías
            data.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id;
                option.textContent = sub.nombre;
                select.appendChild(option);
            });

            wrapper.style.display = 'flex';
            if (dividerSubcat) dividerSubcat.style.display = '';
        } else {
            wrapper.style.display = 'none';
            if (dividerSubcat) dividerSubcat.style.display = 'none';
        }
    } catch (err) {
        console.error('Error cargando subcategorías:', err);
        wrapper.style.display = 'none';
        if (dividerSubcat) dividerSubcat.style.display = 'none';
    }
}

// Limpiar subcategorías
function limpiarSubcategorias() {
    const wrapper = document.getElementById('subcategoria-wrapper');
    const select = document.getElementById('filtro-subcategoria');
    
    if (wrapper) {
        wrapper.style.display = 'none';
    }
    
    const dividerSubcat = document.querySelector('.filtro-divider-subcat');
    if (dividerSubcat) {
        dividerSubcat.style.display = 'none';
    }
    
    if (select) {
        select.innerHTML = '<option value="">Ver Todos</option>';
    }
    
    subcategoriaSeleccionada = null;
}

// Limpiar subcategorías
// Filtrar productos por subcategoría
function filtrarPorSubcategoriaProductos() {
    const categoria = filtroActivoPage;
    const subcatSelect = document.getElementById('filtro-subcategoria');
    const subcatId = subcatSelect ? subcatSelect.value : '';
    subcategoriaSeleccionada = subcatId ? parseInt(subcatId) : null;

    let productosFiltrados = allProductosPage;

    // Primero filtrar por categoría
    if (categoria !== 'Todos' && categoria !== 'Ofertas') {
        productosFiltrados = productosFiltrados.filter(p => p.categoria === categoria);
    } else if (categoria === 'Ofertas') {
        productosFiltrados = productosFiltrados.filter(p => p.descuento_oferta && p.descuento_oferta > 0);
    }

    // Luego filtrar por subcategoría si está seleccionada
    if (subcategoriaSeleccionada) {
        productosFiltrados = productosFiltrados.filter(p => p.subcategoria_id === subcategoriaSeleccionada);
    }

    // Aplicar búsqueda si existe
    const buscador = document.getElementById('buscador-productos');
    if (buscador && buscador.value) {
        const busqueda = buscador.value.toLowerCase();
        productosFiltrados = productosFiltrados.filter(p =>
            p.nombre.toLowerCase().includes(busqueda) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(busqueda))
        );
    }

    // Aplicar ordenamiento
    productosFiltrados = aplicarOrdenamientoAProductos(productosFiltrados);

    mostrarProductos(productosFiltrados);
}

function aplicarFiltroProductos(categoria) {
    console.log('📌 aplicarFiltroProductos llamado con:', categoria);
    
    filtroActivoPage = categoria;
    categoriaActualPagina = categoria;
    subcategoriaSeleccionada = null; // Resetear subcategoría
    ordenamientoActual = 'relevancia'; // Resetear ordenamiento

    // Actualizar el dropdown de categoría
    const catSelect = document.getElementById('filtro-categoria');
    if (catSelect) {
        catSelect.value = categoria;
    }

    // Resetear ordenamiento dropdown
    const ordSelect = document.getElementById('filtro-ordenamiento');
    if (ordSelect) {
        ordSelect.value = 'relevancia';
    }

    let productosFiltrados = allProductosPage;

    if (categoria === 'Ofertas') {
        // Filtrar solo productos con descuento (sin filtrar por stock)
        productosFiltrados = allProductosPage.filter(p => p.descuento_oferta && p.descuento_oferta > 0);
    } else if (categoria !== 'Todos') {
        // Filtrar por categoría (sin filtrar por stock)
        productosFiltrados = allProductosPage.filter(p => p.categoria === categoria);
    } else {
        // Mostrar todos los productos
        productosFiltrados = allProductosPage;
    }

    const buscador = document.getElementById('buscador-productos');
    if (buscador && buscador.value) {
        const busqueda = buscador.value.toLowerCase();
        productosFiltrados = productosFiltrados.filter(p =>
            p.nombre.toLowerCase().includes(busqueda) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(busqueda))
        );
    }

    mostrarProductos(productosFiltrados);

    // Cargar o limpiar subcategorías según la categoría
    console.log('Verificando si cargar subcategorías para:', categoria);
    if (categoria !== 'Todos' && categoria !== 'Ofertas') {
        console.log('✅ Llamando cargarSubcategoriasProductos');
        cargarSubcategoriasProductos(categoria);
    } else {
        console.log('❌ Limpiando subcategorías');
        limpiarSubcategorias();
    }
}

// Función de aplicar ordenamiento
function aplicarOrdenamiento(tipo) {
    ordenamientoActual = tipo;

    // Obtener productos filtrados actuales
    let productosFiltrados = allProductosPage;
    const categoria = filtroActivoPage;

    if (categoria === 'Ofertas') {
        productosFiltrados = productosFiltrados.filter(p => p.descuento_oferta && p.descuento_oferta > 0);
    } else if (categoria !== 'Todos') {
        productosFiltrados = productosFiltrados.filter(p => p.categoria === categoria);
    }

    if (subcategoriaSeleccionada) {
        productosFiltrados = productosFiltrados.filter(p => p.subcategoria_id === subcategoriaSeleccionada);
    }

    const buscador = document.getElementById('buscador-productos');
    if (buscador && buscador.value) {
        const busqueda = buscador.value.toLowerCase();
        productosFiltrados = productosFiltrados.filter(p =>
            p.nombre.toLowerCase().includes(busqueda) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(busqueda))
        );
    }

    // Aplicar ordenamiento
    productosFiltrados = aplicarOrdenamientoAProductos(productosFiltrados);

    mostrarProductos(productosFiltrados);
}

// Función auxiliar para aplicar ordenamiento a un array de productos
function aplicarOrdenamientoAProductos(productos) {
    const copia = [...productos];

    switch (ordenamientoActual) {
        case 'a-z':
            return copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
        case 'z-a':
            return copia.sort((a, b) => b.nombre.localeCompare(a.nombre));
        case 'precio-menor':
            return copia.sort((a, b) => {
                const precioA = a.descuento_oferta > 0 ? a.precio * (1 - a.descuento_oferta / 100) : a.precio;
                const precioB = b.descuento_oferta > 0 ? b.precio * (1 - b.descuento_oferta / 100) : b.precio;
                return precioA - precioB;
            });
        case 'precio-mayor':
            return copia.sort((a, b) => {
                const precioA = a.descuento_oferta > 0 ? a.precio * (1 - a.descuento_oferta / 100) : a.precio;
                const precioB = b.descuento_oferta > 0 ? b.precio * (1 - b.descuento_oferta / 100) : b.precio;
                return precioB - precioA;
            });
        default:
            return copia;
    }
}

// Filtrar por búsqueda
function filtrarPorBusquedaProductos() {
    const busqueda = document.getElementById('buscador-productos').value.toLowerCase();

    let productosFiltrados = allProductosPage;

    if (filtroActivoPage === 'Ofertas') {
        // Filtrar solo productos con descuento (sin filtrar por stock)
        productosFiltrados = productosFiltrados.filter(p => p.descuento_oferta && p.descuento_oferta > 0);
    } else if (filtroActivoPage !== 'Todos') {
        // Filtrar por categoría (sin filtrar por stock)
        productosFiltrados = productosFiltrados.filter(p => p.categoria === filtroActivoPage);
    } else {
        // Mostrar todos los productos
        productosFiltrados = productosFiltrados;
    }

    if (subcategoriaSeleccionada) {
        productosFiltrados = productosFiltrados.filter(p => p.subcategoria_id === subcategoriaSeleccionada);
    }

    if (busqueda) {
        productosFiltrados = productosFiltrados.filter(p =>
            p.nombre.toLowerCase().includes(busqueda) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(busqueda))
        );
    }

    // Aplicar ordenamiento
    productosFiltrados = aplicarOrdenamientoAProductos(productosFiltrados);

    mostrarProductos(productosFiltrados);
}

// Activar filtro visualmente
// auth.js already provides openLoginModal and closeLoginModal functions

// Iniciar cuando todo está listo
window.addEventListener('load', function () {
    // Esperar a que Supabase esté disponible
    let intentos = 0;
    function iniciar() {
        if (window.supabaseClient) {
            cargarProductosPagina();
            updateCartCount();
        } else if (intentos < 50) {
            intentos++;
            setTimeout(iniciar, 100);
        }
    }

    iniciar();
});

