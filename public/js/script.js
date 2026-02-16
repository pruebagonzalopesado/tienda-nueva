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

// ========== AUTENTICACIÓN ==========
let supabaseClient = null;
// let currentUser = null; // Declarado en auth.js
// let userRole = null; // Declarado en auth.js

// ========== CARGAR DATOS DE LA BD ==========

// Variable global para almacenar productos
let allProductos = [];
let filtroActual = 'Todos';

// Cargar productos y renderizar
async function cargarProductosWeb() {
    if (!window.supabaseClient) return;

    const { data: productos, error } = await window.supabaseClient
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error al cargar productos:', error);
        return;
    }

    // Cargar TODOS los productos (incluyendo sin stock)
    allProductos = (productos || []);
    // Aplicar filtro inicial a Anillos (solo 2 productos)
    aplicarFiltroTendencias('Anillos');
}

// Renderizar productos con filtro
function renderizarProductos(productos) {
    const grid = document.querySelector('.productos-grid');
    if (!grid) return;

    grid.innerHTML = '';

    productos.forEach(producto => {
        const card = document.createElement('div');
        card.className = 'producto-card';
        card.style.cursor = 'pointer';

        const etiqueta = producto.etiqueta ? `<div class="producto-etiqueta">${producto.etiqueta}</div>` : '';

        // Badge de oferta si tiene descuento
        const badgeOferta = producto.descuento_oferta && producto.descuento_oferta > 0
            ? `<div class="oferta-badge">-${producto.descuento_oferta}%</div>`
            : '';

        // Parsear imágenes (pueden ser JSON array o string simple)
        let imagenHTML = '<div class="producto-imagen">💎</div>';
        if (producto.imagen_url) {
            try {
                const imagenes = JSON.parse(producto.imagen_url);
                if (Array.isArray(imagenes) && imagenes.length > 0) {
                    imagenHTML = `<img src="${imagenes[0]}" alt="${producto.nombre}" style="width: 100%; height: 200px; object-fit: cover;">`;
                }
            } catch (e) {
                // Si no es JSON, intenta como URL directa
                if (producto.imagen_url.startsWith('http')) {
                    imagenHTML = `<img src="${producto.imagen_url}" alt="${producto.nombre}" style="width: 100%; height: 200px; object-fit: cover;">`;
                }
            }
        }

        // Calcular precio con descuento si existe
        let precioHTML = `<p class="precio">€${parseFloat(producto.precio).toFixed(2)}</p>`;
        if (producto.descuento_oferta && producto.descuento_oferta > 0) {
            const precioConDescuento = producto.precio * (1 - producto.descuento_oferta / 100);
            precioHTML = `
                <div class="precio">
                    <span style="text-decoration: line-through;color: #888;font-size:0.85em;">€${parseFloat(producto.precio).toFixed(2)}</span>
                    <span style="font-weight: bold;color: #d4af37;font-size:1.1em;">€${precioConDescuento.toFixed(2)}</span>
                </div>
            `;
        }

        // Calcular precio final (con descuento si aplica)
        let precioFinal = producto.precio;
        if (producto.descuento_oferta && producto.descuento_oferta > 0) {
            precioFinal = producto.precio * (1 - producto.descuento_oferta / 100);
        }

        // Extraer URL de imagen para el carrito
        let imagenUrl = '';
        if (producto.imagen_url) {
            try {
                const imagenes = JSON.parse(producto.imagen_url);
                imagenUrl = Array.isArray(imagenes) ? imagenes[0] : imagenes;
            } catch (e) {
                imagenUrl = producto.imagen_url;
            }
        }

        // Determinar si hay stock
        const hayStock = producto.stock > 0;
        const stockClass = hayStock ? '' : 'sin-stock';
        const btnDisabled = hayStock ? '' : 'disabled';
        const btnText = hayStock ? 'Agregar al carrito' : 'Sin stock';

        card.innerHTML = `
            ${etiqueta}
            ${badgeOferta}
            <div class="producto-imagen" style="${!hayStock ? 'opacity: 0.5;' : ''}">${imagenHTML}</div>
            ${!hayStock ? '<div class="stock-indicator">Sin stock</div>' : ''}
            <h3>${producto.nombre}</h3>
            ${precioHTML}
            <button class="btn-agregar ${stockClass}" onclick="agregarAlCarrito({id: ${producto.id}, nombre: '${producto.nombre}', precio: ${precioFinal}, imagen: '${imagenUrl}'})" ${btnDisabled}>${btnText}</button>
        `;

        // Hacer el card clickeable para ir a detalle
        card.addEventListener('click', function (e) {
            // Si se hace clic en el botón, no navegar
            if (e.target.className === 'btn-agregar') return;
            window.location.href = `/productos/${producto.id}`;
        });

        grid.appendChild(card);
    });
}


// Renderizar Últimas Tendencias (4 en desktop, 2 en móvil)
function renderizarUltimasTendencias(productos) {
    const grid = document.getElementById('tendencias-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const categorias = ['Anillos', 'Collares', 'Pendientes', 'Pulseras', 'Relojes'];
    
    // Detectar si es móvil (pantalla < 768px)
    const isMobile = window.innerWidth < 768;
    const productosAMostrar = isMobile ? 2 : 4;

    categorias.forEach(categoria => {
        // Obtener 4 en desktop, 2 en móvil
        const productosCat = productos.filter(p => p.categoria === categoria).slice(0, productosAMostrar);

        productosCat.forEach(producto => {
            const card = document.createElement('div');
            card.className = 'producto-card';
            card.style.cursor = 'pointer';

            const etiqueta = producto.etiqueta ? `<div class="producto-etiqueta">${producto.etiqueta}</div>` : '';
            const badgeOferta = producto.descuento_oferta && producto.descuento_oferta > 0
                ? `<div class="oferta-badge">-${producto.descuento_oferta}%</div>`
                : '';

            let imagenHTML = '<div class="producto-imagen">💎</div>';
            if (producto.imagen_url) {
                try {
                    const imagenes = JSON.parse(producto.imagen_url);
                    if (Array.isArray(imagenes) && imagenes.length > 0) {
                        imagenHTML = `<img src="${imagenes[0]}" alt="${producto.nombre}" style="width: 100%; height: 200px; object-fit: cover;">`;
                    }
                } catch (e) {
                    if (producto.imagen_url.startsWith('http')) {
                        imagenHTML = `<img src="${producto.imagen_url}" alt="${producto.nombre}" style="width: 100%; height: 200px; object-fit: cover;">`;
                    }
                }
            }

            let precioHTML = `<p class="precio">€${parseFloat(producto.precio).toFixed(2)}</p>`;
            if (producto.descuento_oferta && producto.descuento_oferta > 0) {
                const precioConDescuento = producto.precio * (1 - producto.descuento_oferta / 100);
                precioHTML = `
                    <div style="display:flex;gap:10px;align-items:center;">
                        <span style="text-decoration: line-through;color: #888;font-size:0.9em;">€${parseFloat(producto.precio).toFixed(2)}</span>
                        <span style="margin-left: 5px;font-weight: bold;color: #d4af37;">€${precioConDescuento.toFixed(2)}</span>
                    </div>
                `;
            }

            let precioFinal = producto.precio;
            if (producto.descuento_oferta && producto.descuento_oferta > 0) {
                precioFinal = producto.precio * (1 - producto.descuento_oferta / 100);
            }

            // Extraer URL de imagen para el carrito
            let imagenUrl = '';
            if (producto.imagen_url) {
                try {
                    const imagenes = JSON.parse(producto.imagen_url);
                    imagenUrl = Array.isArray(imagenes) ? imagenes[0] : imagenes;
                } catch (e) {
                    imagenUrl = producto.imagen_url;
                }
            }

            card.innerHTML = `
                ${etiqueta}
                ${badgeOferta}
                <div class="producto-imagen">${imagenHTML}</div>
                <h3>${producto.nombre}</h3>
                ${precioHTML}
                <button class="btn-agregar" onclick="agregarAlCarrito({id: ${producto.id}, nombre: '${producto.nombre}', precio: ${precioFinal}, imagen: '${imagenUrl}'})">Agregar al carrito</button>
            `;

            card.addEventListener('click', function (e) {
                if (e.target.className === 'btn-agregar') return;
                window.location.href = `/productos/${producto.id}`;
            });

            grid.appendChild(card);
        });
    });
}

// Aplicar filtro en Últimas Tendencias
function aplicarFiltroTendencias(categoria) {
    const grid = document.getElementById('tendencias-grid');
    if (!grid) return;

    // Actualizar botones activos
    const botones = document.querySelectorAll('.filtros-productos .filtro-btn');
    botones.forEach(btn => {
        btn.classList.remove('activo');
        if (btn.textContent.trim() === categoria) {
            btn.classList.add('activo');
        }
    });

    // Detectar si es móvil (pantalla < 768px)
    const isMobile = window.innerWidth < 768;
    const productosAMostrar = isMobile ? 2 : 4;

    // Filtrar y mostrar 2 en móvil, 4 en desktop
    const productosCat = allProductos.filter(p => p.categoria === categoria).slice(0, productosAMostrar);

    grid.innerHTML = '';

    productosCat.forEach(producto => {
        const card = document.createElement('div');
        card.className = 'producto-card';
        card.style.cursor = 'pointer';

        const etiqueta = producto.etiqueta ? `<div class="producto-etiqueta">${producto.etiqueta}</div>` : '';
        const badgeOferta = producto.descuento_oferta && producto.descuento_oferta > 0
            ? `<div class="oferta-badge">-${producto.descuento_oferta}%</div>`
            : '';

        let imagenHTML = '<div class="producto-imagen">💎</div>';
        if (producto.imagen_url) {
            try {
                const imagenes = JSON.parse(producto.imagen_url);
                if (Array.isArray(imagenes) && imagenes.length > 0) {
                    imagenHTML = `<img src="${imagenes[0]}" alt="${producto.nombre}" style="width: 100%; height: 200px; object-fit: cover;">`;
                }
            } catch (e) {
                if (producto.imagen_url.startsWith('http')) {
                    imagenHTML = `<img src="${producto.imagen_url}" alt="${producto.nombre}" style="width: 100%; height: 200px; object-fit: cover;">`;
                }
            }
        }

        let precioHTML = `<p class="precio">€${parseFloat(producto.precio).toFixed(2)}</p>`;
        if (producto.descuento_oferta && producto.descuento_oferta > 0) {
            const precioConDescuento = producto.precio * (1 - producto.descuento_oferta / 100);
            precioHTML = `
                <div style="display:flex;gap:10px;align-items:center;">
                    <span style="text-decoration: line-through;color: #888;font-size:0.9em;">€${parseFloat(producto.precio).toFixed(2)}</span>
                    <span style="margin-left: 5px;font-weight: bold;color: #d4af37;">€${precioConDescuento.toFixed(2)}</span>
                </div>
            `;
        }

        let precioFinal = producto.precio;
        if (producto.descuento_oferta && producto.descuento_oferta > 0) {
            precioFinal = producto.precio * (1 - producto.descuento_oferta / 100);
        }

        // Extraer URL de imagen para el carrito
        let imagenUrl = '';
        if (producto.imagen_url) {
            try {
                const imagenes = JSON.parse(producto.imagen_url);
                imagenUrl = Array.isArray(imagenes) ? imagenes[0] : imagenes;
            } catch (e) {
                imagenUrl = producto.imagen_url;
            }
        }

        card.innerHTML = `
            ${etiqueta}
            ${badgeOferta}
            <div class="producto-imagen">${imagenHTML}</div>
            <h3>${producto.nombre}</h3>
            ${precioHTML}
            <button class="btn-agregar" onclick="agregarAlCarrito({id: ${producto.id}, nombre: '${producto.nombre}', precio: ${precioFinal}, imagen: '${imagenUrl}'})">Agregar al carrito</button>
        `;

        card.addEventListener('click', function (e) {
            if (e.target.className === 'btn-agregar') return;
            window.location.href = `/productos/${producto.id}`;
        });

        grid.appendChild(card);
    });
}


// Renderizar Últimas Tendencias (2 de cada categoría)
function renderizarUltimasTendencias(productos) {
    const grid = document.getElementById('tendencias-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const categorias = ['Anillos', 'Collares', 'Pendientes', 'Pulseras', 'Relojes'];

    categorias.forEach(categoria => {
        // Obtener los primeros 2 productos de esta categoría
        const productosCat = productos.filter(p => p.categoria === categoria).slice(0, 2);

        productosCat.forEach(producto => {
            const card = document.createElement('div');
            card.className = 'producto-card';
            card.style.cursor = 'pointer';

            const etiqueta = producto.etiqueta ? `<div class="producto-etiqueta">${producto.etiqueta}</div>` : '';
            const badgeOferta = producto.descuento_oferta && producto.descuento_oferta > 0
                ? `<div class="oferta-badge">-${producto.descuento_oferta}%</div>`
                : '';

            let imagenHTML = '<div class="producto-imagen">💎</div>';
            if (producto.imagen_url) {
                try {
                    const imagenes = JSON.parse(producto.imagen_url);
                    if (Array.isArray(imagenes) && imagenes.length > 0) {
                        imagenHTML = `<img src="${imagenes[0]}" alt="${producto.nombre}" style="width: 100%; height: 200px; object-fit: cover;">`;
                    }
                } catch (e) {
                    if (producto.imagen_url.startsWith('http')) {
                        imagenHTML = `<img src="${producto.imagen_url}" alt="${producto.nombre}" style="width: 100%; height: 200px; object-fit: cover;">`;
                    }
                }
            }

            let precioHTML = `<p class="precio">€${parseFloat(producto.precio).toFixed(2)}</p>`;
            if (producto.descuento_oferta && producto.descuento_oferta > 0) {
                const precioConDescuento = producto.precio * (1 - producto.descuento_oferta / 100);
                precioHTML = `
                    <div style="display:flex;gap:10px;align-items:center;">
                        <span style="text-decoration: line-through;color: #888;font-size:0.9em;">€${parseFloat(producto.precio).toFixed(2)}</span>
                        <span style="margin-left: 5px;font-weight: bold;color: #d4af37;">€${precioConDescuento.toFixed(2)}</span>
                    </div>
                `;
            }

            let precioFinal = producto.precio;
            if (producto.descuento_oferta && producto.descuento_oferta > 0) {
                precioFinal = producto.precio * (1 - producto.descuento_oferta / 100);
            }

            // Extraer URL de imagen para el carrito
            let imagenUrl = '';
            if (producto.imagen_url) {
                try {
                    const imagenes = JSON.parse(producto.imagen_url);
                    imagenUrl = Array.isArray(imagenes) ? imagenes[0] : imagenes;
                } catch (e) {
                    imagenUrl = producto.imagen_url;
                }
            }

            card.innerHTML = `
                ${etiqueta}
                ${badgeOferta}
                <div class="producto-imagen">${imagenHTML}</div>
                <h3>${producto.nombre}</h3>
                ${precioHTML}
                <button class="btn-agregar" onclick="agregarAlCarrito({id: ${producto.id}, nombre: '${producto.nombre}', precio: ${precioFinal}, imagen: '${imagenUrl}'})">Agregar al carrito</button>
            `;

            card.addEventListener('click', function (e) {
                if (e.target.className === 'btn-agregar') return;
                window.location.href = `/productos/${producto.id}`;
            });

            grid.appendChild(card);
        });
    });
}


// Cargar ofertas (DESACTIVADO - Sección eliminada)
async function cargarOfertasWeb() {
    // Función desactivada - Sección de ofertas eliminada
    return;
}

function irAlProducto(id) {
    window.location.href = `/productos/${id}`;
}

// Cargar slides de galería (ya está en iniciarGaleriaAutomatica)
async function cargarSlidesBD() {
    if (!window.supabaseClient) return;

    const { data: slides, error } = await window.supabaseClient
        .from('gallery_slides')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true });

    if (error) {
        console.error('Error al cargar slides:', error);
        return;
    }

    const container = document.querySelector('.galeria-container');
    if (!container) return;

    container.innerHTML = '';

    slides.forEach((slide, index) => {
        const slideEl = document.createElement('div');
        slideEl.className = `galeria-slide ${index === 0 ? 'activo' : ''}`;
        slideEl.innerHTML = `
            ${slide.imagen_url ? `<img src="${slide.imagen_url}" alt="${slide.titulo}" class="slide-image">` : '<div class="slide-bg" style="background: linear-gradient(135deg, var(--color-secundario) 0%, #501429 100%);"></div>'}
            <div class="slide-content">
                <h2>${slide.titulo}</h2>
                <p>${slide.descripcion || ''}</p>
                <button class="btn-principal" onclick="irAGaleria('${slide.enlace_url || ''}')" style="cursor: pointer;">Ver Más</button>
            </div>
        `;
        container.appendChild(slideEl);
    });

    // Actualizar indicadores
    actualizarIndicadores();
}

// Función para ir a la galería específica
function irAGaleria(url) {
    if (!url) {
        console.warn('No hay URL configurada para esta galería');
        return;
    }
    window.location.href = url;
}

// ========== AUTENTICACIÓN ==========
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

// REMOVIDO: window.logout está definido en auth-new.js
// window.logout = async function () {
//     if (supabaseClient) {
//         await supabaseClient.auth.signOut();
//     }
//     currentUser = null;
//     userRole = null;
//     window.location.href = '/';
// };

// Comentado: Autenticación movida a auth.js
// function initAuth() {
//     if (!window.supabaseClient) {
//         setTimeout(initAuth, 100);
//         return;
//     }
//
//     supabaseClient = window.supabaseClient;
//
//     const form = document.getElementById('login-form');
//     if (form) {
//         form.addEventListener('submit', handleLogin);
//     }
//
//     const modal = document.getElementById('login-modal');
//     if (modal) {
//         modal.addEventListener('click', function (e) {
//             if (e.target === modal) window.closeLoginModal();
//         });
//     }
//
//     checkSession();
// }
//
// async function handleLogin(e) {
//     e.preventDefault();
//
//     const email = document.getElementById('login-email').value;
//     const password = document.getElementById('login-password').value;
//     const btn = this.querySelector('button[type="submit"]');
//
//     btn.disabled = true;
//     btn.textContent = 'Cargando...';
//
//     try {
//         const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
//
//         if (error) throw error;
//
//         currentUser = data.user;
//         console.log('Usuario logueado:', currentUser.id);
//
//         // Obtener rol - versión tolerante sin .single()
//         const { data: roles, error: roleError } = await supabaseClient
//             .from('user_roles')
//             .select('role')
//             .eq('user_id', currentUser.id);
//
//         console.log('Roles encontrados:', roles);
//
//         if (roles && roles.length > 0) {
//             userRole = roles[0].role;
//             console.log('Rol asignado:', userRole);
//         } else {
//             console.log('No se encontró rol para este usuario');
//             userRole = 'user';
//         }
//
//         if (userRole === 'admin') {
//             console.log('Redirigiendo a admin...');
//             window.location.href = '/admin.html';
//         } else {
//             console.log('Usuario normal, cerrando modal');
//             window.closeLoginModal();
//             updateAuthUI();
//         }
//     } catch (error) {
//         console.error('Error en login:', error);
//         alert('Error: ' + error.message);
//     } finally {
//         btn.disabled = false;
//         btn.textContent = 'Iniciar Sesión';
//     }
// }

// Removido: checkSession() y updateAuthUI() están en auth.js
// async function checkSession() {
//     try {
//         const { data: { session } } = await supabaseClient.auth.getSession();
//
//         if (session) {
//             currentUser = session.user;
//             const { data: roles } = await supabaseClient
//                 .from('user_roles')
//                 .select('role')
//                 .eq('user_id', currentUser.id);
//
//             if (roles && roles.length > 0) {
//                 userRole = roles[0].role;
//             }
//         }
//
//         updateAuthUI();
//     } catch (error) {
//         console.error('Error verificando sesión:', error);
//     }
// }

// function updateAuthUI() {
//     const authBtn = document.getElementById('auth-button');
//     if (!authBtn) return;
//
//     if (currentUser) {
//         authBtn.innerHTML = `
//             <div class="user-menu">
//                 <button id="user-info-btn" class="btn-usuario">👤 ${currentUser.email.split('@')[0]}</button>
//                 <div id="user-dropdown" class="user-dropdown" style="display:none;">
//                     ${userRole === 'admin' ? '<a href="/admin.html">Panel Admin</a>' : ''}
//                     <button onclick="window.logout()">Cerrar Sesión</button>
//                 </div>
//             </div>
//         `;
//
//         document.getElementById('user-info-btn').addEventListener('click', function (e) {
//             e.stopPropagation();
//             const dd = document.getElementById('user-dropdown');
//             dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
//         });
//
//         document.addEventListener('click', function (e) {
//             const dd = document.getElementById('user-dropdown');
//             if (dd && !e.target.closest('.user-menu')) {
//                 dd.style.display = 'none';
//             }
//         });
//     } else {
//         authBtn.innerHTML = `<button onclick="window.openLoginModal()" class="btn-login">Iniciar Sesión</button>`;
//     }
// }
//
// // Iniciar auth cuando Supabase esté listo
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', initAuth);
// } else {
//     initAuth();
// }

// ========== GALERÍA Y CARRITO ==========
// Variables globales para la galería

let slideActual = 0;
let autoSlideInterval;

// Funcionalidad del carrito (se define en carrito.js si es necesario)
// let carrito = [];  // Comentado para evitar conflictos con carrito.js

// Inicialización
document.addEventListener('DOMContentLoaded', function () {
    // Iniciar galería automática
    iniciarGaleriaAutomatica();

    // Agregarde eventos a los botones de agregar al carrito
    const botonesAgregar = document.querySelectorAll('.btn-agregar');

    botonesAgregar.forEach(boton => {
        boton.addEventListener('click', function () {
            const card = this.closest('.producto-card');
            const nombre = card.querySelector('h3').textContent;
            const precio = card.querySelector('.precio').textContent;

            agregarAlCarrito(nombre, precio);
            mostrarNotificacion('Producto agregado al carrito');
        });
    });

    // Botón principal del hero
    const botonesHero = document.querySelectorAll('.slide-content .btn-principal');
    botonesHero.forEach(btn => {
        btn.addEventListener('click', function () {
            document.getElementById('productos').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Navegación suave
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return; // Ignorar enlaces vacíos
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Formulario de contacto
    const formulario = document.querySelector('.formulario-contacto');
    if (formulario) {
        formulario.addEventListener('submit', function (e) {
            e.preventDefault();
            mostrarNotificacion('¡Mensaje enviado correctamente! Nos pondremos en contacto pronto.');
            this.reset();
        });
    }

    // Formulario newsletter
    const formularioNewsletter = document.querySelector('.formulario-newsletter');
    if (formularioNewsletter) {
        formularioNewsletter.addEventListener('submit', function (e) {
            e.preventDefault();
            mostrarNotificacion('¡Te has suscrito correctamente!');
            this.reset();
        });
    }
});

// Funciones de Galería
function cambiarSlide(n) {
    mostrarSlide(slideActual += n);
    reiniciarTimer();
}

function irAlSlide(n) {
    mostrarSlide(slideActual = n);
    reiniciarTimer();
}

function mostrarSlide(n) {
    const slides = document.querySelectorAll('.galeria-slide');
    const indicadores = document.querySelectorAll('.indicador');

    if (n >= slides.length) {
        slideActual = 0;
    }
    if (n < 0) {
        slideActual = slides.length - 1;
    }

    slides.forEach((slide, index) => {
        slide.classList.remove('activo', 'anterior');
        if (index === slideActual) {
            slide.classList.add('activo');
        } else if (index < slideActual) {
            slide.classList.add('anterior');
        }
    });

    indicadores.forEach((ind, index) => {
        ind.classList.remove('activo');
        if (index === slideActual) {
            ind.classList.add('activo');
        }
    });
}

function actualizarIndicadores() {
    const container = document.querySelector('.galeria-indicadores');
    const slides = document.querySelectorAll('.galeria-slide');
    if (!container) return;

    container.innerHTML = '';
    slides.forEach((slide, index) => {
        const span = document.createElement('span');
        span.className = `indicador ${index === 0 ? 'activo' : ''}`;
        span.onclick = () => irAlSlide(index);
        container.appendChild(span);
    });
}

function iniciarGaleriaAutomatica() {
    autoSlideInterval = setInterval(() => {
        slideActual++;
        mostrarSlide(slideActual);
    }, 5000);
}

function reiniciarTimer() {
    clearInterval(autoSlideInterval);
    iniciarGaleriaAutomatica();
}

// Función para agregar al carrito
async function agregarAlCarrito(producto) {
    // 🛡️ Protección contra múltiples clics
    if (window.agregarAlCarritoEnProceso) {
        console.warn('[agregarAlCarrito] Ya hay una operación en progreso, ignorando clic');
        return;
    }
    window.agregarAlCarritoEnProceso = true;
    
    // Verificar si el producto tiene stock
    const productoEnBD = allProductos.find(p => p.id === producto.id);
    if (!productoEnBD || productoEnBD.stock <= 0) {
        window.agregarAlCarritoEnProceso = false;
        mostrarMensajeErrorStock('Lo siento, este producto no tiene stock disponible en este momento.');
        return;
    }

    // Si es un anillo, mostrar modal para seleccionar talla
    if (productoEnBD.categoria === 'Anillos') {
        // Enriquecer con la imagen - prioridad: objeto original > parsear imagen_url > fallback
        let imagenUrl = producto.imagen || '';
        if (!imagenUrl && productoEnBD.imagen_url) {
            try {
                const imagenes = JSON.parse(productoEnBD.imagen_url);
                imagenUrl = Array.isArray(imagenes) ? imagenes[0] : imagenes;
            } catch (e) {
                imagenUrl = productoEnBD.imagen_url;
            }
        }
        
        const productoConImagen = {
            ...productoEnBD,
            imagen: imagenUrl
        };
        // 🛡️ Resetear el flag antes de abrir el modal, será manejado por agregarAlCarritoConTalla()
        window.agregarAlCarritoEnProceso = false;
        abrirModalSeleccionarTalla(productoConImagen);
        return;
    }

    // Obtener carrito actual desde localStorage
    let cart = JSON.parse(localStorage.getItem('carrito') || '[]');

    // Si el argumento es un objeto simple, convertirlo
    if (typeof producto === 'object') {
        const item = {
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: 1,
            imagen: producto.imagen || '',
            tiempoAgregado: Date.now() // Timestamp cuando se agrega
        };

        // Buscar si el producto ya está en el carrito
        const existingItem = cart.find(i => i.id === item.id);
        
        // NUEVA VALIDACIÓN: Verificar que la cantidad total no supere el stock
        let cantidadEnCarrito = existingItem ? existingItem.cantidad : 0;
        let cantidadTotal = cantidadEnCarrito + 1;
        
        if (cantidadTotal > productoEnBD.stock) {
            window.agregarAlCarritoEnProceso = false;
            const stockDisponible = productoEnBD.stock - cantidadEnCarrito;
            mostrarMensajeErrorStock(`No hay suficiente stock disponible.\n\nYa tienes ${cantidadEnCarrito} en el carrito.\nStock disponible: ${stockDisponible}`);
            return;
        }

        if (existingItem) {
            existingItem.cantidad += 1;
        } else {
            cart.push(item);
        }
    }

    // Guardar en localStorage
    localStorage.setItem('carrito', JSON.stringify(cart));
    
    // 🔑 IMPORTANTE: Si es el primer item, guardar timestamp en sessionStorage
    if (cart.length === 1 || !sessionStorage.getItem('carritoTimestamp')) {
        const ahora = Date.now();
        sessionStorage.setItem('carritoTimestamp', ahora.toString());
        window.carritoTimestamp = ahora;
    }
    
    actualizarCarrito();
    
    // Restar stock de la base de datos
    if (window.supabaseClient && typeof producto === 'object') {
        fetch('/api/update-cart-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: producto.id,
                cantidad: 1,
                accion: 'restar'
            })
        })
        .then(res => {
            if (!res.ok) {
                console.warn('[script agregarAlCarrito] API error:', res.status);
                return null;
            }
            return res.json();
        })
        .then(data => {
            if (data?.success) {
                console.log('[script agregarAlCarrito] Stock actualizado:', data);
            }
        })
        .catch(err => console.warn('[script agregarAlCarrito] Error actualizando stock:', err));
    }
    
    // Abrir slide-over del carrito
    if (typeof openCartSlide === 'function') {
        openCartSlide();
    }
    
    // 🛡️ Resetear flag de protección
    window.agregarAlCarritoEnProceso = false;
}

// Función para actualizar el carrito
function actualizarCarrito() {
    const cart = JSON.parse(localStorage.getItem('carrito') || '[]');
    const total = cart.reduce((sum, item) => sum + item.cantidad, 0);
    const cartCountEl = document.getElementById('cart-count');
    if (cartCountEl) {
        cartCountEl.textContent = total;
    }
}

// Mostrar mensaje de error de stock
function mostrarMensajeErrorStock(mensaje) {
    // Crear contenedor del mensaje si no existe
    let errorDiv = document.getElementById('error-stock-home');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-stock-home';
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
// Función para mostrar notificaciones
function mostrarNotificacion(mensaje) {
    const notificacion = document.createElement('div');
    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, var(--color-principal), #E5C158);
        color: var(--color-secundario);
        padding: 15px 25px;
        border-radius: 50px;
        box-shadow: 0 8px 25px rgba(212, 175, 55, 0.3);
        z-index: 1000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;

    notificacion.textContent = mensaje;
    document.body.appendChild(notificacion);

    setTimeout(() => {
        notificacion.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notificacion.remove(), 300);
    }, 3000);
}

// Agregar animación de notificación
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Cargar el carrito desde localStorage al iniciar
window.addEventListener('load', function () {
    const carritoGuardado = localStorage.getItem('carrito');
    if (carritoGuardado) {
        carrito = JSON.parse(carritoGuardado);
        actualizarCarrito();
    }

    // Cargar datos de la BD
    setTimeout(() => {
        cargarSlidesBD();
        cargarProductosWeb();
        cargarOfertasWeb();
    }, 500);
});

// ========== NEWSLETTER ==========
async function handleNewsletterSubscribe(event) {
    event.preventDefault();
    
    const emailInput = document.getElementById('newsletter-email');
    const email = emailInput.value.trim();
    const button = document.querySelector('.newsletter-form button[type="submit"]');
    const originalText = button.textContent;
    
    if (!email) {
        notify.warning('Por favor ingresa un correo válido', 'Email requerido', 3500);
        return;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        notify.error('Por favor ingresa un correo válido', 'Email inválido', 3500);
        return;
    }
    
    button.disabled = true;
    button.textContent = 'Suscribiendo...';
    
    try {
        // Usar el mismo endpoint que el popup para enviar el email
        const response = await fetch('/api/newsletter-popup-subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (data.alreadySubscribed) {
            notify.info('Este correo ya está suscrito a nuestra newsletter', 'Ya suscrito', 3500);
        } else if (data.success) {
            // Mostrar notificación de éxito
            notify.success('¡Te has suscrito a nuestra newsletter exitosamente! Revisa tu email.', 'Suscripción confirmada', 4000);
            
            // Resetear el formulario
            emailInput.value = '';
        } else {
            notify.error(data.message || 'Error al suscribirse', 'Error de suscripción', 5000);
        }
        
    } catch (error) {
        console.error('Error al suscribirse:', error);
        notify.error('Hubo un error al suscribirse. Intenta nuevamente', 'Error de suscripción', 5000);
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

// Configurar botones de filtro

