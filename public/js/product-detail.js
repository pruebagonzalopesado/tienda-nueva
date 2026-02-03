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

let currentProduct = null;
let currentImageIndex = 0;
let allProducts = [];
let selectedSize = null; // Variable para almacenar la talla seleccionada
let availableSizes = []; // Tallas disponibles del producto

// Cargar el producto desde la URL
async function loadProduct() {
    // Extraer ID del pathname (ej: /productos/6)
    const pathParts = window.location.pathname.split('/');
    let productId = pathParts[pathParts.length - 1];
    
    // Si no encontramos ID en pathname, intentar en query string
    if (!productId || isNaN(productId)) {
        const urlParams = new URLSearchParams(window.location.search);
        productId = urlParams.get('id');
    }

    if (!productId) {
        console.error('No se encontró ID de producto en la URL');
        window.location.href = '/';
        return;
    }

    console.log('Cargando producto con ID:', productId);

    // Esperar a que supabase esté listo
    let intentos = 0;
    while (!window.supabaseClient && intentos < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }

    if (!window.supabaseClient) {
        console.error('Supabase no se inicializó');
        window.location.href = '/';
        return;
    }

    try {
        const { data: product, error } = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('id', parseInt(productId))
            .single();

        if (error || !product) {
            console.error('Producto no encontrado', error);
            window.location.href = '/';
            return;
        }

        currentProduct = product;
        renderProduct(product);
        loadRelatedProducts(product.categoria);
        loadAllProducts();
        
        // 🔄 Iniciar sincronización de stock en tiempo real
        iniciarSincronizacionStockTiempoReal();

    } catch (err) {
        console.error('Error cargando producto:', err);
        window.location.href = '/';
    }
}

// Renderizar el producto
async function renderProduct(product) {
    // Obtener imágenes
    let imagenes = [];
    try {
        if (product.imagen_url) {
            imagenes = Array.isArray(product.imagen_url)
                ? product.imagen_url
                : JSON.parse(product.imagen_url);
        }
    } catch (e) {
        console.error('Error parsing imágenes:', e);
        imagenes = [];
    }

    if (!Array.isArray(imagenes)) {
        imagenes = [];
    }

    // Titulo y básico
    document.getElementById('product-name').textContent = product.nombre;

    // Precio con descuento si aplica
    const priceElement = document.getElementById('product-price');
    if (product.descuento_oferta && product.descuento_oferta > 0) {
        const precioConDescuento = product.precio * (1 - product.descuento_oferta / 100);
        priceElement.innerHTML = `
            <span style="text-decoration: line-through;color: #888;font-size:0.8em;">€${parseFloat(product.precio).toFixed(2)}</span>
            <span style="margin-left: 10px;color: #d4af37;font-weight: bold;">€${precioConDescuento.toFixed(2)}</span>
            <span style="margin-left: 10px;background: linear-gradient(135deg, #ff4444, #cc0000);color: white;padding: 4px 8px;border-radius: 4px;font-size: 0.85em;font-weight: bold;">-${product.descuento_oferta}%</span>
        `;

        // Mostrar badge de oferta en la galería
        const badgeContainer = document.getElementById('oferta-badge-container');
        if (badgeContainer) {
            badgeContainer.innerHTML = `<div class="oferta-badge">-${product.descuento_oferta}%</div>`;
        }
    } else {
        priceElement.textContent = `€${parseFloat(product.precio).toFixed(2)}`;
        const badgeContainer = document.getElementById('oferta-badge-container');
        if (badgeContainer) {
            badgeContainer.innerHTML = '';
        }
    }

    document.getElementById('product-category').textContent = product.categoria;
    document.getElementById('product-reference').textContent = product.referencia || 'N/A';
    document.getElementById('product-description').textContent = product.descripcion || 'Sin descripción disponible';

    // Badge de etiqueta
    const badge = document.getElementById('product-badge');
    if (product.etiqueta) {
        badge.textContent = product.etiqueta;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }

    // Stock
    const stockStatus = document.getElementById('product-stock-status');
    
    if (product.stock > 5) {
        stockStatus.textContent = `${product.stock} unidades disponibles`;
        stockStatus.className = 'stock-status in-stock';
    } else if (product.stock > 0) {
        stockStatus.textContent = `Solo ${product.stock} unidades disponibles`;
        stockStatus.className = 'stock-status low-stock';
    } else {
        stockStatus.textContent = 'Agotado';
        stockStatus.className = 'stock-status out-stock';
    }

    // Imagen principal y miniaturas
    if (imagenes.length > 0) {
        currentImageIndex = 0;
        document.getElementById('main-image').src = imagenes[0];
        renderThumbnails(imagenes);
    } else {
        document.getElementById('main-image').src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23f0f0f0" width="400" height="400"/%3E%3C/svg%3E';
    }
    
    // Cargar tallas si es anillo
    if (product.categoria === 'Anillos') {
        await loadRingSizes(product.id);
    } else {
        hideSizeSelector();
    }

    // Habilitar/deshabilitar botones según stock
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const buyBtn = document.querySelector('.btn-secundario.btn-large');

    if (product.stock === 0) {
        addToCartBtn.disabled = true;
        addToCartBtn.style.opacity = '0.5';
        addToCartBtn.style.cursor = 'not-allowed';
        buyBtn.disabled = true;
        buyBtn.style.opacity = '0.5';
        buyBtn.style.cursor = 'not-allowed';
    } else {
        addToCartBtn.disabled = false;
        addToCartBtn.style.opacity = '1';
        addToCartBtn.style.cursor = 'pointer';
        buyBtn.disabled = false;
        buyBtn.style.opacity = '1';
        buyBtn.style.cursor = 'pointer';
    }
}

// Renderizar miniaturas
function renderThumbnails(imagenes) {
    const gallery = document.getElementById('thumbnail-gallery');
    gallery.innerHTML = '';

    imagenes.forEach((img, index) => {
        const thumb = document.createElement('div');
        thumb.className = `thumbnail ${index === 0 ? 'active' : ''}`;
        thumb.innerHTML = `<img src="${img}" alt="Foto ${index + 1}">`;
        thumb.onclick = () => selectImage(index);
        gallery.appendChild(thumb);
    });
}

// Seleccionar imagen
function selectImage(index) {
    let imagenes = [];
    try {
        if (currentProduct.imagen_url) {
            imagenes = Array.isArray(currentProduct.imagen_url)
                ? currentProduct.imagen_url
                : JSON.parse(currentProduct.imagen_url);
        }
    } catch (e) {
        console.error('Error parsing imágenes:', e);
    }

    if (index >= 0 && index < imagenes.length) {
        currentImageIndex = index;
        document.getElementById('main-image').src = imagenes[index];

        // Actualizar thumbnails activas
        document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
            thumb.classList.toggle('active', i === index);
        });
    }
}

// ========== SISTEMA DE TALLAS (ANILLOS) ==========

// Cargar y mostrar todas las tallas disponibles para un anillo (6-22)
async function loadRingSizes(productId) {
    try {
        if (!window.supabaseClient) return;
        
        // Obtener todas las tallas disponibles (6-22)
        const { data: sizes, error } = await window.supabaseClient
            .from('ring_sizes')
            .select('id, size_number')
            .order('size_number', { ascending: true });
        
        if (error) {
            console.log('Tallas no disponibles:', error.message);
            return;
        }
        
        if (!sizes || sizes.length === 0) {
            console.log('No hay tallas definidas');
            hideSizeSelector();
            return;
        }
        
        // Usar todas las tallas disponibles
        availableSizes = sizes.map(s => ({
            id: s.id,
            size: s.size_number
        })).sort((a, b) => a.size - b.size);
        
        console.log('Tallas disponibles:', availableSizes);
        renderSizeSelector();
        
    } catch (err) {
        console.error('Error cargando tallas:', err);
    }
}

// Renderizar el selector de tallas
function renderSizeSelector() {
    const sizeSelector = document.getElementById('size-selector');
    const sizesGrid = document.getElementById('sizes-grid');
    
    if (!sizeSelector || !sizesGrid) return;
    
    // Mostrar selector
    sizeSelector.style.display = 'block';
    sizesGrid.innerHTML = '';
    selectedSize = null;
    
    // Crear botones de talla
    availableSizes.forEach(size => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'size-btn';
        btn.textContent = size.size;
        btn.dataset.sizeId = size.id;
        btn.style.cssText = `
            padding: 0.5rem;
            border: 2px solid #d4af37;
            background: white;
            color: #333;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: center;
        `;
        
        btn.addEventListener('mouseover', () => {
            if (btn !== selectedSize) {
                btn.style.background = '#f9f9f9';
            }
        });
        
        btn.addEventListener('mouseout', () => {
            if (btn !== selectedSize) {
                btn.style.background = 'white';
            }
        });
        
        btn.addEventListener('click', () => selectSize(btn, size.id));
        
        sizesGrid.appendChild(btn);
    });
}

// Seleccionar talla
function selectSize(btn, sizeId) {
    // Deseleccionar talla anterior
    document.querySelectorAll('.size-btn').forEach(b => {
        b.style.background = 'white';
        b.style.color = '#333';
    });
    
    // Seleccionar nueva talla
    btn.style.background = '#d4af37';
    btn.style.color = 'white';
    selectedSize = btn;
    console.log('Talla seleccionada:', sizeId);
}

// Ocultar selector de tallas
function hideSizeSelector() {
    const sizeSelector = document.getElementById('size-selector');
    if (sizeSelector) {
        sizeSelector.style.display = 'none';
    }
    selectedSize = null;
    availableSizes = [];
}

// Navegación de imágenes
function previousImage() {
    let imagenes = [];
    try {
        if (currentProduct.imagen_url) {
            imagenes = Array.isArray(currentProduct.imagen_url)
                ? currentProduct.imagen_url
                : JSON.parse(currentProduct.imagen_url);
        }
    } catch (e) { }

    if (imagenes.length > 0) {
        currentImageIndex = (currentImageIndex - 1 + imagenes.length) % imagenes.length;
        selectImage(currentImageIndex);
    }
}

function nextImage() {
    let imagenes = [];
    try {
        if (currentProduct.imagen_url) {
            imagenes = Array.isArray(currentProduct.imagen_url)
                ? currentProduct.imagen_url
                : JSON.parse(currentProduct.imagen_url);
        }
    } catch (e) { }

    if (imagenes.length > 0) {
        currentImageIndex = (currentImageIndex + 1) % imagenes.length;
        selectImage(currentImageIndex);
    }
}

// Controlar cantidad
function increaseQuantity() {
    const qty = document.getElementById('quantity');
    const maxStock = currentProduct ? currentProduct.stock : 999;
    if (parseInt(qty.value) < maxStock) {
        qty.value = parseInt(qty.value) + 1;
    }
}

function decreaseQuantity() {
    const qty = document.getElementById('quantity');
    if (parseInt(qty.value) > 1) {
        qty.value = parseInt(qty.value) - 1;
    }
}

// Agregar al carrito
async function agregarAlCarritoDetalle() {
    if (!currentProduct) return;
    
    const productId = currentProduct.id;
    if (!productId) {
        console.error('[agregarAlCarritoDetalle] productId no disponible');
        return;
    }

    // Validar talla si es anillo
    if (currentProduct.categoria === 'Anillos' && availableSizes.length > 0 && !selectedSize) {
        abrirModalValidarTalla();
        return;
    }

    const quantity = parseInt(document.getElementById('quantity').value);

    // Validar stock con el servidor
    validarYAgregarAlCarritoDetalle(quantity);
}

// Función para validar stock y agregar al carrito desde product-detail
async function validarYAgregarAlCarritoDetalle(quantity) {
    try {
        // Validar con el servidor
        const response = await fetch('/api/add-to-cart-validated', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: currentProduct.id,
                cantidad: quantity
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Stock insuficiente o agotado
            console.warn('[validarYAgregarAlCarritoDetalle] Stock insuficiente:', data);
            
            const stockDisponible = data.stockDisponible || 0;
            let mensaje = '';
            
            if (stockDisponible === 0) {
                mensaje = `Lo sentimos, el producto ${currentProduct.nombre} se ha agotado. Otro usuario lo acaba de comprar.`;
            } else {
                mensaje = `Stock insuficiente. Solo quedan ${stockDisponible} ${stockDisponible === 1 ? 'unidad' : 'unidades'} disponible${stockDisponible === 1 ? '' : 's'}, pero intentaste agregar ${quantity}.`;
            }
            
            mostrarModalAlerta('Stock no disponible', mensaje, 'error');
            
            // Actualizar inmediatamente el stock en la página
            actualizarStockDisponibleEnPagina();
            
            return;
        }

        // Stock validado, agregar al carrito local
        let precioFinal = currentProduct.precio;
        if (currentProduct.descuento_oferta && currentProduct.descuento_oferta > 0) {
            precioFinal = currentProduct.precio * (1 - currentProduct.descuento_oferta / 100);
        }

        let cart = JSON.parse(localStorage.getItem('carrito') || '[]');

        const cartItem = {
            id: currentProduct.id,
            nombre: currentProduct.nombre,
            precio: precioFinal,
            cantidad: quantity,
            imagen: (() => {
                try {
                    const imgs = Array.isArray(currentProduct.imagen_url)
                        ? currentProduct.imagen_url
                        : JSON.parse(currentProduct.imagen_url || '[]');
                    return imgs[0] || '';
                } catch {
                    return '';
                }
            })(),
            tiempoAgregado: Date.now()
        };
        
        // Agregar talla si es anillo
        if (currentProduct.categoria === 'Anillos' && selectedSize) {
            cartItem.talla = selectedSize.textContent;
            cartItem.tallaId = selectedSize.dataset.sizeId;
        }

        const existingItem = cart.find(item => 
            item.id === currentProduct.id && 
            (item.talla === cartItem.talla || (!item.talla && !cartItem.talla))
        );

        if (existingItem) {
            existingItem.cantidad += quantity;
        } else {
            cart.push(cartItem);
        }

        localStorage.setItem('carrito', JSON.stringify(cart));
        updateCartCount();

        console.log('[agregarAlCarritoDetalle] ✅ Producto agregado al carrito:', currentProduct.nombre, 'cantidad:', quantity);

        // Actualizar stock en la UI
        if (window.actualizarStockDesdeModal && currentProduct.id) {
            await window.actualizarStockDesdeModal(currentProduct.id);
        }

        // 🔁 Forzar actualización inmediata del stock en otros usuarios
        if (typeof window.forzarActualizacionStock === 'function') {
            setTimeout(() => {
                window.forzarActualizacionStock();
            }, 100);
        }

        // Abrir slide-over del carrito
        if (typeof openCartSlide === 'function') {
            openCartSlide();
        }

        // Resetear cantidad y talla
        document.getElementById('quantity').value = 1;
        if (selectedSize) {
            selectedSize.style.background = 'white';
            selectedSize.style.color = '#333';
            selectedSize = null;
        }

    } catch (error) {
        console.error('[validarYAgregarAlCarritoDetalle] Error:', error);
        notify.error('Error al validar stock. Intenta nuevamente', 'Error de validación', 4000);
    }
}

// Comprar ahora
async function comprarAhora() {
    await agregarAlCarritoDetalle();
    window.location.href = '/carrito';
}

// Cargar productos relacionados
async function loadRelatedProducts(categoria) {
    let intentos = 0;
    while (!window.supabaseClient && intentos < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }

    if (!window.supabaseClient) return;

    try {
        const { data: products } = await window.supabaseClient
            .from('products')
            .select('*')
            .eq('categoria', categoria)
            .neq('id', currentProduct.id)
            .gt('stock', 0)
            .limit(4);

        renderRelatedProducts(products || []);
    } catch (err) {
        console.error('Error cargando productos relacionados:', err);
    }
}

// Renderizar productos relacionados
function renderRelatedProducts(products) {
    const grid = document.getElementById('related-products-grid');
    grid.innerHTML = '';

    products.forEach(product => {
        let imagenURL = '';
        try {
            const imgs = Array.isArray(product.imagen_url)
                ? product.imagen_url
                : JSON.parse(product.imagen_url || '[]');
            imagenURL = imgs[0] || '';
        } catch (e) { }

        const card = document.createElement('div');
        card.className = 'producto-card';
        card.onclick = () => {
            window.location.href = `/productos/${product.id}`;
        };

        card.innerHTML = `
            <div class="producto-imagen">
                ${imagenURL ? `<img src="${imagenURL}" alt="${product.nombre}">` : '[Imagen no disponible]'}
            </div>
            <div class="producto-content">
                <div class="producto-nombre">${product.nombre}</div>
                <div class="producto-precio">€${parseFloat(product.precio).toFixed(2)}</div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// Cargar todos los productos (para carrito)
async function loadAllProducts() {
    let intentos = 0;
    while (!window.supabaseClient && intentos < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        intentos++;
    }

    if (!window.supabaseClient) return;

    try {
        const { data: products } = await window.supabaseClient
            .from('products')
            .select('*')
            .gt('stock', 0);

        allProducts = products || [];
        updateCartCount();
    } catch (err) {
        console.error('Error cargando productos:', err);
    }
}

// Actualizar contador del carrito
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('carrito') || '[]');
    const count = cart.reduce((total, item) => total + item.cantidad, 0);
    document.getElementById('cart-count').textContent = count;
}

// Abrir modal de login
window.openLoginModal = function () {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'flex';
};

// Cerrar modal de login
window.closeLoginModal = function () {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('login-form');
    if (form) form.reset();
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded - iniciando carga de producto');
    // Esperar a que Supabase esté listo
    setTimeout(() => {
        console.log('Llamando a loadProduct()');
        loadProduct();
        updateCartCount();
    }, 300);
});

// Teclas de navegación
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') previousImage();
    if (e.key === 'ArrowRight') nextImage();
});
// ===== GUÍA DE TALLAS =====
// Tabla de conversión de tallas de anillo (diámetro en mm vs talla)
const TALLAS_CONVERSION = [
    { mm: 14.3, talla: 6 },
    { mm: 14.6, talla: 7 },
    { mm: 15.2, talla: 8 },
    { mm: 15.5, talla: 9 },
    { mm: 15.9, talla: 10 },
    { mm: 16.2, talla: 11 },
    { mm: 16.5, talla: 12 },
    { mm: 16.8, talla: 13 },
    { mm: 17.1, talla: 14 },
    { mm: 17.4, talla: 15 },
    { mm: 17.8, talla: 16 },
    { mm: 18.0, talla: 17 },
    { mm: 18.4, talla: 18 },
    { mm: 18.7, talla: 19 },
    { mm: 19.0, talla: 20 },
    { mm: 19.3, talla: 21 },
    { mm: 19.6, talla: 22 }
];

function abrirGuiaTallas() {
    const modal = document.getElementById('modal-guia-tallas');
    const tbody = document.getElementById('tbody-guia-tallas');
    
    if (!modal || !tbody) return;
    
    // Llenar la tabla
    tbody.innerHTML = TALLAS_CONVERSION.map(item => `
        <tr style="border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 0.75rem; color: #666;">${item.mm} mm</td>
            <td style="padding: 0.75rem; text-align: center; font-weight: 600; color: #000;">${item.talla}</td>
        </tr>
    `).join('');
    
    // Congelar página
    document.body.style.overflow = 'hidden';
    
    // Mostrar modal
    modal.style.display = 'flex';
}

function cerrarGuiaTallas() {
    const modal = document.getElementById('modal-guia-tallas');
    if (modal) {
        modal.style.display = 'none';
        // Descongelar página
        document.body.style.overflow = '';
    }
}

function abrirMedidorInteligente() {
    const medidor = document.getElementById('modal-medidor');
    if (medidor) {
        medidor.style.display = 'flex';
        // Limpiar input anterior
        const input = document.getElementById('input-diametro');
        if (input) {
            input.value = '';
            input.focus();
        }
        // Ocultar resultado anterior
        document.getElementById('resultado-talla').style.display = 'none';
    }
}

function cerrarMedidorInteligente() {
    const medidor = document.getElementById('modal-medidor');
    if (medidor) {
        medidor.style.display = 'none';
    }
}

function calcularTalla() {
    const input = document.getElementById('input-diametro');
    const diametro = parseFloat(input.value);
    
    if (!diametro || diametro <= 0) {
        notify.warning('Por favor ingresa un valor válido', 'Entrada inválida', 3000);
        return;
    }
    
    // Buscar la talla más cercana
    let tallaMasProxima = TALLAS_CONVERSION[0];
    let diferenciaMinima = Math.abs(TALLAS_CONVERSION[0].mm - diametro);
    
    for (let i = 1; i < TALLAS_CONVERSION.length; i++) {
        const diferencia = Math.abs(TALLAS_CONVERSION[i].mm - diametro);
        if (diferencia < diferenciaMinima) {
            diferenciaMinima = diferencia;
            tallaMasProxima = TALLAS_CONVERSION[i];
        }
    }
    
    // Mostrar resultado
    document.getElementById('talla-resultado').textContent = tallaMasProxima.talla;
    document.getElementById('resultado-talla').style.display = 'block';
}

// Cerrar modal al hacer click fuera
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal-guia-tallas');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cerrarGuiaTallas();
            }
        });
    }
    
    const medidor = document.getElementById('modal-medidor');
    if (medidor) {
        medidor.addEventListener('click', (e) => {
            if (e.target === medidor) {
                cerrarMedidorInteligente();
            }
        });
    }

    // Event listener para cerrar modal de validación al hacer clic fuera
    const modalValidarTalla = document.getElementById('modal-validar-talla');
    if (modalValidarTalla) {
        modalValidarTalla.addEventListener('click', (e) => {
            if (e.target === modalValidarTalla) {
                cerrarModalValidarTalla();
            }
        });
    }
    
    // Permitir calcular talla al presionar Enter
    const inputDiametro = document.getElementById('input-diametro');
    if (inputDiametro) {
        inputDiametro.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                calcularTalla();
            }
        });
    }
});

// ========== FUNCIONES PARA MODAL DE VALIDACIÓN DE TALLA ==========

function abrirModalValidarTalla() {
    const modal = document.getElementById('modal-validar-talla');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function cerrarModalValidarTalla() {
    const modal = document.getElementById('modal-validar-talla');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ========== ACTUALIZAR STOCK EN TIEMPO REAL ==========
// Sistema robusto de actualización de stock - se ejecuta cada vez que el carrito cambia

// 1. Escuchar evento personalizado de carrito actualizado
window.addEventListener('carritoActualizado', function(event) {
    console.log('[product-detail] Evento carritoActualizado recibido:', event.detail);
    actualizarStockDisponibleEnPagina();
});

// Escuchar cuando el stock se actualiza desde removeFromCartSlide
window.addEventListener('stockActualizado', function(event) {
    console.log('[product-detail] Stock actualizado en BD:', event.detail);
    // Si el producto actualizado es el actual, recargar su stock
    if (event.detail && event.detail.productId === currentProduct?.id) {
        currentProduct.stock = event.detail.stockNuevo;
        console.log('[product-detail] currentProduct.stock actualizado a:', event.detail.stockNuevo);
        actualizarStockDisponibleEnPagina();
    }
});

// 2. Monitorear cambios en localStorage (para esta pestaña - usando interval)
setInterval(() => {
    if (window._ultimoCarritoLocal !== localStorage.getItem('carrito')) {
        window._ultimoCarritoLocal = localStorage.getItem('carrito');
        console.log('[product-detail] Cambio detectado en localStorage');
        actualizarStockDisponibleEnPagina();
    }
}, 500); // Verificar cada 500ms

// ===== SINCRONIZACIÓN DE STOCK EN TIEMPO REAL =====
let stockSyncInterval = null;

function iniciarSincronizacionStockTiempoReal() {
    // Limpiar intervalo anterior si existe
    if (stockSyncInterval) {
        clearInterval(stockSyncInterval);
    }
    
    console.log('[product-detail] Iniciando sincronización de stock en tiempo real (cada 1 segundo)');
    
    // Sincronizar stock cada 1 segundo
    stockSyncInterval = setInterval(async () => {
        if (!currentProduct || !window.supabaseClient) return;
        
        try {
            // Obtener stock actual de la BD
            const { data: producto, error } = await window.supabaseClient
                .from('products')
                .select('stock')
                .eq('id', currentProduct.id)
                .single();
            
            if (error || !producto) {
                console.warn('[product-detail] Error sincronizando stock:', error);
                return;
            }
            
            // Si el stock cambió, actualizar
            if (producto.stock !== currentProduct.stock) {
                console.log(`[product-detail] 🔄 STOCK ACTUALIZADO EN TIEMPO REAL: ${currentProduct.stock} → ${producto.stock}`);
                currentProduct.stock = producto.stock;
                
                // Si se agotó, mostrar notificación
                if (producto.stock === 0 && currentProduct.stock > 0) {
                    console.log('[product-detail] ⚠️ PRODUCTO AGOTADO EN TIEMPO REAL');
                    mostrarNotificacionAgotado();
                }
                
                // Actualizar UI inmediatamente
                actualizarStockDisponibleEnPagina();
                
                // Si se agotó, deshabilitar botones
                if (producto.stock === 0) {
                    const agregarBtn = document.getElementById('agregar-al-carrito-btn');
                    const buyBtn = document.querySelector('.btn-secundario.btn-large');
                    if (agregarBtn) {
                        agregarBtn.disabled = true;
                        agregarBtn.textContent = 'Agotado';
                    }
                    if (buyBtn) {
                        buyBtn.disabled = true;
                        buyBtn.style.opacity = '0.5';
                    }
                }
            }
        } catch (err) {
            console.warn('[product-detail] Error en sincronización:', err);
        }
    }, 1000); // Cada 1 segundo
}

function detenerSincronizacionStockTiempoReal() {
    if (stockSyncInterval) {
        clearInterval(stockSyncInterval);
        stockSyncInterval = null;
        console.log('[product-detail] Sincronización de stock detenida');
    }
}

function mostrarNotificacionAgotado() {
    // Crear notificación flotante
    const notificacion = document.createElement('div');
    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ff4444, #cc0000);
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        animation: slideInRight 0.3s ease;
        font-weight: 600;
        max-width: 300px;
    `;
    
    notificacion.textContent = '⚠️ ' + (currentProduct.nombre || 'Producto') + ' se ha agotado. Otro usuario lo acaba de comprar.';
    
    document.body.appendChild(notificacion);
    
    // Agregar estilos de animación si no existen
    if (!document.getElementById('product-detail-animations')) {
        const style = document.createElement('style');
        style.id = 'product-detail-animations';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Eliminar después de 5 segundos
    setTimeout(() => {
        notificacion.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            notificacion.remove();
        }, 300);
    }, 5000);
}

function actualizarStockDisponibleEnPagina() {
    if (!currentProduct) {
        console.log('[actualizarStockDisponibleEnPagina] currentProduct aún no está listo');
        return;
    }

    try {
        const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
        
        // Calcular cantidad del producto actual en carrito
        let cantidadEnCarrito = 0;
        for (let item of carrito) {
            if (item.id === currentProduct.id) {
                cantidadEnCarrito += item.cantidad;
            }
        }

        // El stock mostrado es el que quedó en la BD después de restar lo que está en carrito
        // NO restar de nuevo porque ya fue restado en la BD
        const stockDisponible = currentProduct.stock;
        
        console.log('[actualizarStockDisponibleEnPagina] Producto:', currentProduct.nombre, 'Stock BD (ya restado):', currentProduct.stock, 'En carrito:', cantidadEnCarrito, 'Disponible:', stockDisponible);

        // Actualizar elemento del DOM
        const stockStatus = document.getElementById('product-stock-status');
        if (stockStatus) {
            if (stockDisponible > 5) {
                stockStatus.textContent = `${stockDisponible} unidades disponibles`;
                stockStatus.className = 'stock-status in-stock';
            } else if (stockDisponible > 0) {
                stockStatus.textContent = `Solo ${stockDisponible} ${stockDisponible === 1 ? 'unidad' : 'unidades'} disponible${stockDisponible === 1 ? '' : 's'}`;
                stockStatus.className = 'stock-status low-stock';
            } else {
                stockStatus.textContent = 'Agotado';
                stockStatus.className = 'stock-status out-stock';
            }
        }

        // Actualizar botones
        const agregarBtn = document.getElementById('agregar-al-carrito-btn');
        if (agregarBtn) {
            if (stockDisponible <= 0) {
                agregarBtn.disabled = true;
                agregarBtn.textContent = 'Agotado';
                agregarBtn.style.opacity = '0.5';
                agregarBtn.style.cursor = 'not-allowed';
            } else {
                agregarBtn.disabled = false;
                agregarBtn.textContent = 'Agregar al Carrito';
                agregarBtn.style.opacity = '1';
                agregarBtn.style.cursor = 'pointer';
            }
        }
    } catch (err) {
        console.error('[actualizarStockDisponibleEnPagina] Error:', err);
    }
}

// ===== REFRESCO AUTOMÁTICO DE STOCK =====
// Escuchar cambios en localStorage (cuando se agrega/elimina del carrito)
// y refrescar el stock de la BD automáticamente
window.addEventListener('storage', async (e) => {
    if (e.key === 'carrito' && currentProduct) {
        console.log('[product-detail] Storage change detectado - recargando stock de BD');
        
        // Refresco de stock desde BD
        if (window.supabaseClient && currentProduct.id) {
            try {
                const { data: producto, error } = await window.supabaseClient
                    .from('products')
                    .select('stock')
                    .eq('id', currentProduct.id)
                    .single();
                
                if (!error && producto) {
                    currentProduct.stock = producto.stock;
                    console.log('[product-detail] Stock refrescado desde BD:', producto.stock);
                    actualizarStockDisponibleEnPagina();
                }
            } catch (err) {
                console.error('[product-detail] Error refrescando stock:', err);
            }
        }
    }
});

// También escuchar eventos personalizados del carrito
document.addEventListener('carritoActualizado', async (e) => {
    console.log('[product-detail] carritoActualizado event - refrescando stock de BD');
    
    if (window.supabaseClient && currentProduct && currentProduct.id) {
        try {
            const { data: producto, error } = await window.supabaseClient
                .from('products')
                .select('stock')
                .eq('id', currentProduct.id)
                .single();
            
            if (!error && producto) {
                currentProduct.stock = producto.stock;
                console.log('[product-detail] Stock refrescado:', producto.stock);
                actualizarStockDisponibleEnPagina();
            }
        } catch (err) {
            console.error('[product-detail] Error refrescando stock:', err);
        }
    }
});

// Función global para refrescar stock desde modal
window.actualizarStockDesdeModal = async function(productId) {
    console.log('[actualizarStockDesdeModal] Iniciando refres para producto:', productId, 'currentProduct:', currentProduct?.id);
    
    if (!window.supabaseClient) {
        console.warn('[actualizarStockDesdeModal] supabaseClient no disponible');
        return;
    }
    
    // Validar que tenemos un productId válido
    if (!productId) {
        console.warn('[actualizarStockDesdeModal] productId no disponible, intentando usar currentProduct.id');
        if (!currentProduct || !currentProduct.id) {
            console.error('[actualizarStockDesdeModal] No hay productId disponible');
            return;
        }
        productId = currentProduct.id;
    }
    
    // Si no hay currentProduct o es diferente, crear uno temporal
    if (!currentProduct || currentProduct.id !== productId) {
        console.log('[actualizarStockDesdeModal] currentProduct no coincide, creando temporal');
    }
    
    try {
        const { data: producto, error } = await window.supabaseClient
            .from('products')
            .select('stock')
            .eq('id', productId)
            .single();
        
        if (error) {
            console.error('[actualizarStockDesdeModal] Error query:', error);
            return;
        }
        
        if (!producto) {
            console.warn('[actualizarStockDesdeModal] Producto no encontrado');
            return;
        }
        
        console.log('[actualizarStockDesdeModal] Stock obtenido de BD:', producto.stock);
        
        // Actualizar currentProduct si existe y coincide
        if (currentProduct && currentProduct.id === productId) {
            currentProduct.stock = producto.stock;
            console.log('[actualizarStockDesdeModal] currentProduct.stock actualizado');
            actualizarStockDisponibleEnPagina();
        } else {
            console.log('[actualizarStockDesdeModal] currentProduct no coincide, actualizando solo DOM');
            // Actualizar DOM directamente sin currentProduct
            const stockStatus = document.getElementById('product-stock-status');
            if (stockStatus) {
                if (producto.stock > 5) {
                    stockStatus.textContent = `${producto.stock} unidades disponibles`;
                    stockStatus.className = 'stock-status in-stock';
                } else if (producto.stock > 0) {
                    stockStatus.textContent = `Solo ${producto.stock} unidades disponibles`;
                    stockStatus.className = 'stock-status low-stock';
                } else {
                    stockStatus.textContent = 'Agotado';
                    stockStatus.className = 'stock-status out-stock';
                }
                console.log('[actualizarStockDesdeModal] DOM actualizado');
            }
        }
    } catch (err) {
        console.error('[actualizarStockDesdeModal] Error:', err);
    }
};

// Fin del archivo product-detail.js