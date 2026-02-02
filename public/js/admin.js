// JS del Panel Admin
let supabaseAdmin = null;

let productoEditar = null;
let ofertaEditar = null;
let slideEditar = null;
let slideImagenUrl = null; // Variable para almacenar imagen del slide
let imagenesEditando = null; // Variables para almacenar imágenes durante edición
let productosPaginaActual = 1; // Variable para paginación

// VERIFICACIÓN DE ADMIN - EJECUTAR PRIMERO
async function verificarAdminAlCargar() {
    try {
        console.log('Verificando permisos de admin...');
        
        // Esperar a que Supabase esté disponible
        let intentos = 0;
        while (!window.supabaseClient && intentos < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            intentos++;
        }
        
        if (!window.supabaseClient) {
            console.error('Supabase no disponible');
            window.location.href = '/admin-login.html';
            return;
        }
        
        const supabase = window.supabaseClient;
        
        // Verificar sesión
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.log('Sin sesión, redirigiendo a login');
            window.location.href = '/admin-login.html';
            return;
        }
        
        // Verificar que sea admin
        const { data: usuario, error } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', session.user.id)
            .single();
        
        if (error || !usuario) {
            console.log('Usuario no encontrado, redirigiendo a login');
            window.location.href = '/admin-login.html';
            return;
        }
        
        if (usuario.rol !== 'admin') {
            console.log('Usuario no es admin, redirigiendo a login');
            window.location.href = '/admin-login.html';
            return;
        }
        
        console.log('✅ Usuario es admin, permitiendo acceso');
        
    } catch (err) {
        console.error('Error en verificación de admin:', err);
        window.location.href = '/admin-login.html';
    }
}

// Ejecutar verificación cuando se carga el script
verificarAdminAlCargar();

// Esperar a que Supabase esté disponible
function waitForSupabaseAdmin(callback, maxAttempts = 100) {
    let attempts = 0;
    function check() {
        attempts++;
        if (window.supabaseClient) {
            supabaseAdmin = window.supabaseClient;
            window.supabaseAdmin = supabaseAdmin;
            console.log('admin.js: Supabase conectado correctamente en intento', attempts);
            callback();
        } else if (attempts < maxAttempts) {
            setTimeout(check, 150);
        } else {
            console.error('admin.js: No se pudo conectar a Supabase después de', maxAttempts, 'intentos');
        }
    }
    check();
}

// Función personalizada de confirmación
function mostrarConfirmacion(mensaje, callback) {
    const modal = document.getElementById('confirm-modal');
    const messageEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    
    messageEl.textContent = mensaje;
    modal.style.display = 'flex';
    
    const handleOk = () => {
        modal.style.display = 'none';
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        callback(true);
    };
    
    const handleCancel = () => {
        modal.style.display = 'none';
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        callback(false);
    };
    
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
}

// Función para mostrar notificaciones toast
function mostrarNotificacion(mensaje, tipo = 'success', duracion = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensaje;
    
    document.body.appendChild(toast);
    
    // Trigger animación de entrada
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remover después de la duración
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duracion);
}

// Función para verificar/crear columna descuento_oferta en productos
async function verificarColumenDescuentoOferta() {
    try {
        // Intentar leer un producto para ver si la columna existe
        const { data, error } = await supabaseAdmin
            .from('products')
            .select('descuento_oferta')
            .limit(1);
        
        if (error && error.message.includes('descuento_oferta')) {
            // La columna no existe, intentar crearla con RPC
            console.log('Agregando columna descuento_oferta...');
            const { error: rpcError } = await supabaseAdmin.rpc('create_descuento_oferta_column');
            if (rpcError) {
                console.log('No se puede crear la columna automáticamente. Asegúrate de que exista en la BD.');
            }
        }
    } catch (err) {
        console.error('Error al verificar columna:', err);
    }
}

// Función para subir imagen a Storage con autorización JWT
// ===== CONFIGURACIÓN CLOUDINARY =====
const CLOUDINARY_CONFIG = {
    cloudName: 'Dvwudlogd',
    uploadPreset: 'Galiana',
    apiKey: ''
};

async function subirImagen(file, carpeta) {
    if (!file) return null;
    
    try {
        console.log('Subiendo imagen a Cloudinary:', file.name);
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `joyeria-galiana/${carpeta}`);
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error en Cloudinary:', errorData);
            return null;
        }
        
        const data = await response.json();
        console.log('Imagen subida a Cloudinary, public_id:', data.public_id);
        
        // Construir URL con transformaciones según la carpeta
        let urlConTransformaciones = data.secure_url;
        
        if (carpeta === 'productos') {
            // Productos: 1200x1200, calidad 72, WebP
            urlConTransformaciones = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/w_1200,h_1200,c_fill,q_72,f_webp/${data.public_id}.webp`;
        } else if (carpeta === 'galeria') {
            // Galería: optimizar automáticamente, WebP
            urlConTransformaciones = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/q_auto,f_webp/${data.public_id}.webp`;
        } else {
            // Otras carpetas: WebP con calidad automática
            urlConTransformaciones = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/q_auto,f_webp/${data.public_id}.webp`;
        }
        
        console.log('URL final:', urlConTransformaciones);
        return urlConTransformaciones;
        
    } catch (error) {
        console.error('Error en subida a Cloudinary:', error);
        return null;
    }
}

// Verificar si es admin y cargar datos
async function initAdmin() {
    console.log('admin.js: Iniciando initAdmin()...');
    
    // Esperar a que supabase esté disponible
    waitForSupabaseAdmin(async function() {
        console.log('admin.js: Supabase disponible, cargando datos...');
        
        // Verificar sesión pero no redirigir
        try {
            const { data: { session } } = await supabaseAdmin.auth.getSession();
            
            if (session && document.getElementById('user-email')) {
                document.getElementById('user-email').textContent = session.user.email;
            }
        } catch (err) {
            console.log('admin.js: Error al obtener sesión:', err);
        }
        
        // Verificar que la columna descuento_oferta existe en products
        await verificarColumenDescuentoOferta();
        
        // Cargar datos
        console.log('admin.js: Cargando productos...');
        await cargarProductos();
        console.log('admin.js: Cargando ofertas...');
        await cargarOfertas();
        console.log('admin.js: Cargando galería...');
        await cargarGaleria();
        console.log('admin.js: Cargando pedidos...');
        await cargarPedidos();
        console.log('admin.js: Cargando newsletter...');
        await loadNewsletterData();
        console.log('admin.js: Cargando mensajes de contacto...');
        await loadContactMessages();
        console.log('admin.js: Actualizando stats...');
        await actualizarStats();
        console.log('admin.js: Cargando datos de ventas...');
        await cargarDatosVentas();
        
        console.log('admin.js: Todos los datos cargados');
        
        // Configurar navegación de secciones
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                if (section) {
                    cambiarSeccion(section);
                }
            });
        });
    });
}

// Iniciar cuando esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        setTimeout(async () => {
            await initAdmin();
        }, 500);
    });
} else {
    setTimeout(async () => {
        await initAdmin();
    }, 500);
}

// Cambiar sección activa
function cambiarSeccion(section) {
    // Ocultar todas las secciones
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    document.getElementById(section).classList.add('active');
    
    // Actualizar nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    // Resetear paginación si es productos
    if (section === 'productos') {
        productosPaginaActual = 1;
        const inputBusqueda = document.getElementById('buscar-productos');
        if (inputBusqueda) {
            inputBusqueda.value = '';
        }
        renderizarTablaProductos(productosGlobal);
    }
    
    // Si cambió a newsletter, recargar datos
    if (section === 'newsletter') {
        loadNewsletterData();
    }
    
    // Si cambió a contacto, recargar datos
    if (section === 'contacto') {
        loadContactMessages();
    }
}

// ========== PRODUCTOS ==========

let productosGlobal = []; // Variable para almacenar todos los productos

async function cargarProductos() {
    const { data, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error al cargar productos:', error);
        return;
    }
    
    // Guardar productos globalmente para búsqueda
    productosGlobal = data || [];
    productosPaginaActual = 1;
    
    console.log('Productos cargados:', productosGlobal.length);
    
    // Renderizar tabla
    renderizarTablaProductos(productosGlobal);
    
    // Agregar evento a campo de búsqueda
    const inputBusqueda = document.getElementById('buscar-productos');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', filtrarProductos);
    }
}

function renderizarTablaProductos(productos) {
    const tbody = document.getElementById('productos-tbody');
    tbody.innerHTML = '';
    
    console.log('Renderizando productos, total:', productos.length);
    
    // Paginación: 10 productos por página
    const ITEMS_POR_PAGINA = 10;
    const totalPaginas = Math.ceil(productos.length / ITEMS_POR_PAGINA);
    const inicio = (productosPaginaActual - 1) * ITEMS_POR_PAGINA;
    const fin = inicio + ITEMS_POR_PAGINA;
    const productosPagina = productos.slice(inicio, fin);
    
    console.log('Total páginas calculadas:', totalPaginas);
    console.log('Página actual:', productosPaginaActual);
    console.log('Productos en esta página:', productosPagina.length);
    
    productosPagina.forEach(producto => {
        const row = document.createElement('tr');
        
        // Aplicar estilo rojo si stock es 0
        const estoRojo = producto.stock === 0 || producto.stock === '0';
        const estilo = estoRojo ? 'style="background-color: #ffe6e6; color: #c00; font-weight: 600;"' : '';
        
        row.innerHTML = `
            <td ${estilo}>${producto.nombre}</td>
            <td ${estilo}>€${parseFloat(producto.precio).toFixed(2)}</td>
            <td ${estilo}>${producto.categoria}</td>
            <td ${estilo}>${producto.stock} ${estoRojo ? 'SIN STOCK' : ''}</td>
            <td>
                <button class="btn-editar" onclick="editarProducto(${producto.id})">Editar</button>
                <button class="btn-eliminar" onclick="eliminarProducto(${producto.id})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Renderizar paginación DESPUÉS de la tabla, sin limpiar el container
    renderizarPaginacionFinal(totalPaginas, 'pagination-productos', (pagina) => {
        productosPaginaActual = pagina;
        renderizarTablaProductos(productos);
    });
}

function renderizarPaginacionFinal(totalPaginas, containerId, onPageChange) {
    const container = document.getElementById(containerId);
    
    if (!container) {
        return;
    }
    
    // Limpiar y crear botones de paginación
    container.innerHTML = '';
    
    // Si no hay suficientes páginas, no mostrar nada
    if (totalPaginas <= 1) {
        return;
    }
    
    // Botón anterior
    if (productosPaginaActual > 1) {
        const btnAnterior = document.createElement('button');
        btnAnterior.textContent = '← Anterior';
        btnAnterior.style.cssText = 'padding: 0.75rem 1.5rem; background: #d4af37; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
        btnAnterior.onclick = () => onPageChange(productosPaginaActual - 1);
        container.appendChild(btnAnterior);
    }
    
    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        const btnPage = document.createElement('button');
        btnPage.textContent = i;
        
        if (i === productosPaginaActual) {
            btnPage.style.cssText = 'padding: 0.75rem 1rem; background: #d4af37; color: white; border: 2px solid #d4af37; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
        } else {
            btnPage.style.cssText = 'padding: 0.75rem 1rem; background: white; color: #d4af37; border: 2px solid #d4af37; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
            btnPage.onclick = () => onPageChange(i);
        }
        
        container.appendChild(btnPage);
    }
    
    // Botón siguiente
    if (productosPaginaActual < totalPaginas) {
        const btnSiguiente = document.createElement('button');
        btnSiguiente.textContent = 'Siguiente →';
        btnSiguiente.style.cssText = 'padding: 0.75rem 1.5rem; background: #d4af37; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
        btnSiguiente.onclick = () => onPageChange(productosPaginaActual + 1);
        container.appendChild(btnSiguiente);
    }
}

function filtrarProductos() {
    const terminoBusqueda = document.getElementById('buscar-productos').value.toLowerCase();
    productosPaginaActual = 1; // Resetear a página 1
    
    if (!terminoBusqueda) {
        renderizarTablaProductos(productosGlobal);
        return;
    }
    
    const productosFiltrados = productosGlobal.filter(producto => {
        const nombre = (producto.nombre || '').toLowerCase();
        const referencia = (producto.referencia || '').toLowerCase();
        
        return nombre.includes(terminoBusqueda) || referencia.includes(terminoBusqueda);
    });
    
    renderizarTablaProductos(productosFiltrados);
}

function limpiarBusquedaProductos() {
    const inputBusqueda = document.getElementById('buscar-productos');
    if (inputBusqueda) {
        inputBusqueda.value = '';
        productosPaginaActual = 1; // Resetear a página 1
        renderizarTablaProductos(productosGlobal);
    }
}

function abrirFormularioProducto() {
    productoEditar = null;
    imagenesEditando = []; // Inicializar como array vacío
    
    // Verificar que los elementos existan antes de manipularlos
    const formularioTitulo = document.getElementById('formulario-titulo');
    const formProducto = document.getElementById('form-producto');
    const formularioProducto = document.getElementById('formulario-producto');
    
    if (!formularioTitulo || !formProducto || !formularioProducto) {
        console.error('Error: Elementos del formulario no encontrados');
        return;
    }
    
    formularioTitulo.textContent = 'Agregar Nuevo Producto';
    formProducto.reset();
    
    // Limpiar galería de imágenes
    const galeriaExistente = document.getElementById('prod-imagenes-existentes');
    if (galeriaExistente) {
        galeriaExistente.innerHTML = '';
    }
    
    // Inicializar zona de subida de imágenes
    inicializarZonaSubidaImagenes();
    
    // Cargar subcategorías y tallas para la categoría por defecto (Anillos)
    const categSelect = document.getElementById('prod-categoria');
    if (categSelect) {
        cargarSubcategorias(categSelect.value);
        mostrarSeccionTallas(categSelect.value);
    }
    
    // Agregar listener a cambio de categoría para mostrar/ocultar tallas
    if (categSelect) {
        categSelect.onchange = function() {
            cargarSubcategorias(this.value);
            mostrarSeccionTallas(this.value);
        };
    }
    
    // Limpiar checkbox de tallas
    const checkboxTallas = document.getElementById('prod-usa-tallas');
    if (checkboxTallas) {
        checkboxTallas.checked = false;
    }
    
    formularioProducto.style.display = 'block';
}

function inicializarZonaSubidaImagenes() {
    const zonaSubida = document.getElementById('zona-subida-imagenes');
    const inputFile = document.getElementById('prod-imagen-file');
    
    if (!zonaSubida || !inputFile) return;
    
    // Evitar agregar listeners duplicados
    if (zonaSubida.dataset.inicializado === 'true') {
        return;
    }
    zonaSubida.dataset.inicializado = 'true';
    
    // Click en la zona
    zonaSubida.addEventListener('click', () => {
        inputFile.click();
    });
    
    // Cambio de archivo
    inputFile.addEventListener('change', (e) => {
        const archivo = e.target.files[0];
        if (archivo) {
            procesarImagenSeleccionada(archivo);
            // Limpiar el input para permitir seleccionar el mismo archivo otra vez
            inputFile.value = '';
        }
    });
    
    // Drag and drop
    zonaSubida.addEventListener('dragover', (e) => {
        e.preventDefault();
        zonaSubida.style.borderColor = '#720916';
        zonaSubida.style.backgroundColor = '#fff5f5';
    });
    
    zonaSubida.addEventListener('dragleave', () => {
        zonaSubida.style.borderColor = '#d4af37';
        zonaSubida.style.backgroundColor = '#fafaf8';
    });
    
    zonaSubida.addEventListener('drop', (e) => {
        e.preventDefault();
        zonaSubida.style.borderColor = '#d4af37';
        zonaSubida.style.backgroundColor = '#fafaf8';
        
        const archivo = e.dataTransfer.files[0];
        if (archivo && archivo.type.startsWith('image/')) {
            procesarImagenSeleccionada(archivo);
        } else {
            mostrarNotificacion('Por favor arrastra una imagen válida', 'error');
        }
    });
}

async function procesarImagenSeleccionada(archivo) {
    if (!archivo.type.startsWith('image/')) {
        mostrarNotificacion('El archivo debe ser una imagen', 'error');
        return;
    }
    
    try {
        mostrarNotificacion('Subiendo imagen: ' + archivo.name, 'info');
        
        const url = await subirImagen(archivo, 'productos');
        
        if (url) {
            // Agregar a imagenesEditando
            if (!imagenesEditando) {
                imagenesEditando = [];
            }
            imagenesEditando.push(url);
            
            console.log('Imagen agregada:', url);
            console.log('Total de imágenes:', imagenesEditando);
            
            // Actualizar galería
            mostrarImagenesExistentes(imagenesEditando);
            mostrarNotificacion('Imagen agregada correctamente', 'success');
        } else {
            mostrarNotificacion('Error al subir la imagen', 'error');
        }
    } catch (err) {
        console.error('Error procesando imagen:', err);
        mostrarNotificacion('Error al procesar la imagen: ' + err.message, 'error');
    }
}

function cerrarFormularioProducto() {
    document.getElementById('formulario-producto').style.display = 'none';
}

// Función para mostrar imágenes existentes del producto
// Variable para rastrear el elemento siendo arrastrado
let imagenArrastrada = null;

function mostrarImagenesExistentes(imagenUrlJson) {
    const contenedor = document.getElementById('prod-imagenes-existentes');
    if (!contenedor) return;
    
    contenedor.innerHTML = '';
    
    let imagenes = [];
    
    // Parsear JSON si es string
    if (typeof imagenUrlJson === 'string') {
        try {
            imagenes = JSON.parse(imagenUrlJson);
        } catch (e) {
            // Si es una URL única, convertirla a array
            imagenes = imagenUrlJson ? [imagenUrlJson] : [];
        }
    } else if (Array.isArray(imagenUrlJson)) {
        imagenes = imagenUrlJson;
    }
    
    imagenesEditando = [...imagenes]; // Guardar copia
    
    if (imagenes.length === 0) {
        contenedor.innerHTML = '<p style="color: #888; font-size: 0.9em;">Sin imágenes. Sube nuevas.</p>';
        return;
    }
    
    // Crear grid de miniaturas
    contenedor.className = 'imagenes-preview';
    imagenes.forEach((urlImg, index) => {
        if (!urlImg) return; // Saltar URLs vacías
        
        const div = document.createElement('div');
        div.className = 'imagen-thumbnail';
        div.draggable = true;
        div.dataset.index = index;
        div.style.cursor = 'grab';
        
        div.innerHTML = `
            <img src="${urlImg}" alt="Producto ${index + 1}" onerror="this.src='/images/placeholder.png'" style="pointer-events: none;">
            <button class="btn-delete-imagen" type="button" data-index="${index}" aria-label="Eliminar imagen">×</button>
        `;
        
        // Eventos de drag
        div.addEventListener('dragstart', (e) => {
            imagenArrastrada = index;
            div.style.opacity = '0.5';
        });
        
        div.addEventListener('dragend', (e) => {
            div.style.opacity = '1';
            imagenArrastrada = null;
        });
        
        div.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (imagenArrastrada !== null && imagenArrastrada !== index) {
                div.style.borderColor = '#720916';
                div.style.transform = 'scale(0.95)';
            }
        });
        
        div.addEventListener('dragleave', () => {
            div.style.borderColor = '#d4af37';
            div.style.transform = 'scale(1)';
        });
        
        div.addEventListener('drop', (e) => {
            e.preventDefault();
            div.style.borderColor = '#d4af37';
            div.style.transform = 'scale(1)';
            
            if (imagenArrastrada !== null && imagenArrastrada !== index) {
                // Reordenar: sacar la imagen arrastrada e insertarla en la nueva posición
                const [imagenMovida] = imagenesEditando.splice(imagenArrastrada, 1);
                imagenesEditando.splice(index, 0, imagenMovida);
                mostrarImagenesExistentes(imagenesEditando); // Redibujar
            }
        });
        
        contenedor.appendChild(div);
    });
    
    // Agregar event listeners para los botones de eliminar
    document.querySelectorAll('.btn-delete-imagen').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const index = parseInt(btn.getAttribute('data-index'));
            imagenesEditando.splice(index, 1); // Eliminar del array
            mostrarImagenesExistentes(imagenesEditando); // Redibujar
        });
    });
}

// ========== SUBCATEGORÍAS ==========

async function cargarSubcategorias(categoria) {
    const selectSubcategoria = document.getElementById('prod-subcategoria');
    const msgSubcategoria = document.getElementById('msg-subcategoria');
    const labelSubcategoria = document.getElementById('label-subcategoria');
    
    // Si no existen los elementos, retornar sin error
    if (!selectSubcategoria || !msgSubcategoria) {
        console.warn('Elementos de subcategoría no encontrados en el DOM');
        return;
    }
    
    // Limpiar el select
    selectSubcategoria.innerHTML = '<option value="">Selecciona una subcategoría...</option>';
    
    // Si no hay categoría seleccionada, ocultar todo
    if (!categoria) {
        selectSubcategoria.style.display = 'none';
        msgSubcategoria.style.display = 'none';
        if (labelSubcategoria) labelSubcategoria.style.display = 'none';
        return;
    }
    
    // Relojes y Medallas no tienen subcategorías
    if (categoria === 'Relojes' || categoria === 'Medallas') {
        msgSubcategoria.style.display = 'block';
        selectSubcategoria.style.display = 'none';
        if (labelSubcategoria) labelSubcategoria.style.display = 'none';
        return;
    }
    
    // Mostrar elementos de subcategoría
    selectSubcategoria.style.display = 'block';
    msgSubcategoria.style.display = 'none';
    if (labelSubcategoria) labelSubcategoria.style.display = 'block';
    
    try {
        if (!supabaseAdmin) {
            console.warn('Supabase no disponible aún para cargar subcategorías');
            return;
        }
        
        console.log('Cargando subcategorías para categoría:', categoria);
        const { data, error } = await supabaseAdmin
            .from('subcategorias')
            .select('id, nombre')
            .ilike('categoria', categoria)
            .order('nombre', { ascending: true });
        
        if (error) {
            console.warn('Error al cargar subcategorías (tabla puede no existir):', error.message);
            // No mostrar error al usuario, solo continuar sin subcategorías
            msgSubcategoria.style.display = 'block';
            msgSubcategoria.textContent = 'Las subcategorías no están disponibles para esta categoría';
            selectSubcategoria.style.display = 'none';
            return;
        }
        
        if (!data || data.length === 0) {
            console.log('No hay subcategorías para:', categoria);
            msgSubcategoria.style.display = 'block';
            selectSubcategoria.style.display = 'none';
            return;
        }
        
        // Agregar subcategorías al select
        data.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.id;
            option.textContent = sub.nombre;
            selectSubcategoria.appendChild(option);
        });
        
        console.log('Subcategorías cargadas:', data);
        
    } catch (err) {
        console.error('Error completo en cargarSubcategorias:', err.message);
        // No lanzar excepción, permitir continuar sin subcategorías
    }
}

// ========== SISTEMA DE TALLAS (ANILLOS) ==========

// Mostrar/ocultar sección de tallas según categoría
function mostrarSeccionTallas(categoria) {
    const sectionTallas = document.getElementById('section-tallas');
    if (!sectionTallas) return;
    
    // Mostrar solo si es Anillos
    if (categoria === 'Anillos') {
        sectionTallas.style.display = 'block';
    } else {
        sectionTallas.style.display = 'none';
    }
}

// Guardar estado de tallas en el producto
async function guardarUsaTallasProducto(productId, usaTallas) {
    if (!supabaseAdmin || !productId) return;
    
    try {
        const { error } = await supabaseAdmin
            .from('products')
            .update({ has_sizes: usaTallas })
            .eq('id', productId);
        
        if (error) {
            console.error('Error al guardar usa_tallas:', error);
            return;
        }
        
        console.log('usa_tallas guardado:', usaTallas);
    } catch (err) {
        console.error('Error en guardarUsaTallasProducto:', err);
    }
}

async function editarProducto(id) {
    try {
        const { data, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            console.error('Error al cargar producto:', error);
            mostrarNotificacion('No se pudo cargar el producto: ' + error.message, 'error');
            return;
        }
        
        if (!data) {
            mostrarNotificacion('Producto no encontrado', 'error');
            return;
        }
        
        console.log('Editando producto:', data);
        
        productoEditar = id;
        document.getElementById('formulario-titulo').textContent = 'Editar Producto';
        
        // Proteger acceso a elementos
        const nombre = document.getElementById('prod-nombre');
        const precio = document.getElementById('prod-precio');
        const categoria = document.getElementById('prod-categoria');
        const subcategoria = document.getElementById('prod-subcategoria');
        const etiqueta = document.getElementById('prod-etiqueta');
        const descripcion = document.getElementById('prod-descripcion');
        const stock = document.getElementById('prod-stock');
        const referencia = document.getElementById('prod-referencia');
        
        if (!nombre || !precio || !categoria || !etiqueta || !descripcion || !stock) {
            console.error('Error: Elementos del formulario no encontrados');
            mostrarNotificacion('Error: Falta algún campo del formulario', 'error');
            return;
        }
        
        // Llenar campos con valores por defecto si no existen
        nombre.value = data.nombre || '';
        precio.value = data.precio || '';
        categoria.value = data.categoria || '';
        etiqueta.value = data.etiqueta || '';
        descripcion.value = data.descripcion || '';
        stock.value = data.stock || 0;
        if (referencia) referencia.value = data.referencia || '';
        
        // Cargar subcategorías para la categoría seleccionada
        if (data.categoria) {
            await cargarSubcategorias(data.categoria);
            mostrarSeccionTallas(data.categoria);
            
            // Si el producto tiene subcategoría, seleccionarla
            if ((data.subcategoria_id || data.subcategoria) && subcategoria) {
                subcategoria.value = data.subcategoria_id || data.subcategoria || '';
            }
            
            // Cargar estado de tallas si es anillo
            if (data.categoria === 'Anillos') {
                const checkboxTallas = document.getElementById('prod-usa-tallas');
                if (checkboxTallas) {
                    checkboxTallas.checked = data.has_sizes || false;
                }
            }
        }
        
        mostrarNotificacion('Producto cargado correctamente', 'success');
        
        // DEBUG: Loguear datos de imagen
        console.log('Datos completos del producto:', data);
        console.log('imagen_url:', data.imagen_url);
        console.log('Tipo de imagen_url:', typeof data.imagen_url);
        
        // Mostrar imágenes existentes
        if (data.imagen_url) {
            mostrarImagenesExistentes(data.imagen_url);
        } else {
            const imgExistentes = document.getElementById('prod-imagenes-existentes');
            if (imgExistentes) {
                imgExistentes.innerHTML = '';
            }
            imagenesEditando = [];
        }
        
        // Inicializar zona de subida de imágenes (igual que al crear)
        inicializarZonaSubidaImagenes();
        
        document.getElementById('formulario-producto').style.display = 'block';
        
    } catch (err) {
        console.error('Error completo en editarProducto:', err);
        mostrarNotificacion('Error: ' + err.message, 'error');
    }
}

async function guardarProducto(e) {
    try {
        if (!e || !e.preventDefault) {
            console.error('Evento inválido');
            return;
        }
        e.preventDefault();
        
        // Esperar a que supabase esté listo
        if (!supabaseAdmin) {
            mostrarNotificacion('Error: Sistema no inicializado. Por favor recarga la página.', 'error');
            return;
        }
        
        console.log('Guardando producto...');
        
        // Las imágenes ya se subieron cuando se seleccionaron
        // Solo usar las que están en imagenesEditando
        let imagenes = imagenesEditando && imagenesEditando.length > 0 ? [...imagenesEditando] : [];
        
        // Si estamos editando y no hay imágenes nuevas, mantener las antiguas
        let imagenUrl;
        if (productoEditar && imagenes.length === 0) {
            // Al editar sin nuevas imágenes, no actualizar el campo imagen_url
            imagenUrl = undefined; // undefined significa "no actualizar este campo"
            console.log('Editando sin nuevas imágenes - mantener imágenes existentes');
        } else {
            // Guardar como string JSON (vacío si no hay imágenes)
            imagenUrl = imagenes.length > 0 ? JSON.stringify(imagenes) : null;
            console.log('Imágenes finales a guardar:', imagenes);
        }
        
        // Obtener elementos con validación
        const nombre = document.getElementById('prod-nombre');
        const precio = document.getElementById('prod-precio');
        const categoria = document.getElementById('prod-categoria');
        const subcategoria = document.getElementById('prod-subcategoria');
        const etiqueta = document.getElementById('prod-etiqueta');
        const descripcion = document.getElementById('prod-descripcion');
        const stock = document.getElementById('prod-stock');
        const referencia = document.getElementById('prod-referencia');
        
        console.log('Elementos encontrados:', {nombre, precio, categoria, subcategoria, etiqueta, descripcion, stock});
        
        if (!nombre || !precio || !categoria || !etiqueta || !descripcion || !stock) {
            console.error('Faltan elementos:', {nombre, precio, categoria, etiqueta, descripcion, stock});
            mostrarNotificacion('Error: Faltan campos en el formulario', 'error');
            return;
        }
        
        const datos = {
            nombre: nombre.value.trim(),
            precio: parseFloat(precio.value),
            categoria: categoria.value,
            etiqueta: etiqueta.value.trim(),
            descripcion: descripcion.value.trim(),
            stock: parseInt(stock.value) || 0
        };
        
        // Solo actualizar imagen_url si hay nuevas imágenes o es un nuevo producto
        if (imagenUrl !== undefined) {
            datos.imagen_url = imagenUrl;
        }
        
        // Agregar referencia como campo separado
        if (referencia && referencia.value.trim()) {
            datos.referencia = referencia.value.trim();
        }
        
        // Agregar subcategoría si está seleccionada (no para Relojes)
        if (subcategoria && subcategoria.value) {
            datos.subcategoria_id = subcategoria.value;
        } else {
            datos.subcategoria_id = null;
        }
        
        console.log('Datos a guardar:', datos);
        
        if (!datos.nombre) {
            mostrarNotificacion('El nombre del producto es obligatorio', 'error');
            return;
        }
        
        if (isNaN(datos.precio) || datos.precio <= 0) {
            mostrarNotificacion('El precio debe ser un número válido mayor que 0', 'error');
            return;
        }
        
        let response;
        
        if (productoEditar) {
            console.log('Actualizando producto:', productoEditar);
            response = await supabaseAdmin
                .from('products')
                .update(datos)
                .eq('id', productoEditar);
        } else {
            console.log('Creando nuevo producto');
            response = await supabaseAdmin
                .from('products')
                .insert([datos]);
        }
        
        if (response.error) {
            console.error('Error de base de datos:', response.error);
            mostrarNotificacion('Error: ' + response.error.message, 'error');
            return;
        }
        
        // Obtener el ID del producto (nuevo o existente)
        let productId = productoEditar;
        if (!productId && response.data && response.data.length > 0) {
            productId = response.data[0].id;
        }
        
        // Guardar estado de tallas si aplica (solo para Anillos)
        if (categoria && categoria.value === 'Anillos') {
            const checkboxTallas = document.getElementById('prod-usa-tallas');
            if (checkboxTallas) {
                await guardarUsaTallasProducto(productId, checkboxTallas.checked);
            }
        }
        
        console.log('Producto guardado exitosamente');
        cerrarFormularioProducto();
        cargarProductos();
        actualizarStats();
    } catch (err) {
        console.error('Error inesperado:', err);
        mostrarNotificacion('Error inesperado: ' + err.message, 'error');
    }
}

async function eliminarProducto(id) {
    mostrarConfirmacion('¿Estás seguro de que quieres eliminar este producto?', async (confirmado) => {
        if (!confirmado) return;
        
        const { error } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', id);
        
        if (error) {
            mostrarNotificacion('Error: ' + error.message, 'error');
            return;
        }
        
        cargarProductos();
        actualizarStats();
        mostrarNotificacion('Producto eliminado correctamente', 'success');
    });
}

// ========== OFERTAS ==========

async function cargarOfertas() {
    try {
        console.log('[cargarOfertas] Cargando ofertas de productos con descuento_oferta > 0');
        
        // Obtener productos que tengan descuento_oferta mayor a 0
        const { data: productos, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .gt('descuento_oferta', 0)
            .order('updated_at', { ascending: false });
        
        if (error) {
            console.error('[cargarOfertas] Error al cargar ofertas:', error);
            return;
        }
        
        console.log('[cargarOfertas] Productos con ofertas cargados:', productos);
        
        const tbody = document.getElementById('ofertas-tbody');
        tbody.innerHTML = '';
        
        if (!productos || productos.length === 0) {
            console.log('[cargarOfertas] No hay productos con ofertas');
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">No hay ofertas activas</td></tr>';
            return;
        }
        
        productos.forEach(producto => {
            const porcentajeDescuento = producto.descuento_oferta || 0;
            const precioOriginal = parseFloat(producto.precio);
            const precioConDescuento = precioOriginal * (1 - porcentajeDescuento / 100);
            
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${producto.nombre}</td>
                <td>${porcentajeDescuento}%</td>
                <td>€${precioOriginal.toFixed(2)}</td>
                <td>€${precioConDescuento.toFixed(2)}</td>
                <td>
                    <button class="btn-editar" onclick="editarOferta(${producto.id})">Editar</button>
                    <button class="btn-eliminar" onclick="eliminarOferta(${producto.id})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        console.log('[cargarOfertas] Tabla actualizada con', productos.length, 'ofertas');
        
    } catch (error) {
        console.error('[cargarOfertas] Error general:', error);
    }
}

async function cargarProductosEnDropdown() {
    const select = document.getElementById('oferta-producto');
    if (!select) return;
    
    const { data, error } = await supabaseAdmin
        .from('products')
        .select('id, nombre')
        .order('nombre', { ascending: true });
    
    if (error) {
        console.error('Error al cargar productos:', error);
        return;
    }
    
    select.innerHTML = '<option value="">Selecciona un producto</option>';
    data.forEach(producto => {
        const option = document.createElement('option');
        option.value = producto.id;
        option.textContent = producto.nombre;
        select.appendChild(option);
    });
}

function abrirFormularioOferta() {
    ofertaEditar = null;
    
    const tituloEl = document.getElementById('oferta-titulo');
    const formEl = document.getElementById('form-oferta');
    const formularioEl = document.getElementById('formulario-oferta');
    const selectEl = document.getElementById('oferta-producto');
    
    if (!tituloEl || !formEl || !formularioEl || !selectEl) {
        console.error('Error: Elementos del formulario de oferta no encontrados');
        return;
    }
    
    tituloEl.textContent = 'Agregar Oferta a Producto';
    formEl.reset();
    formularioEl.style.display = 'block';
    
    // Cargar productos en el dropdown
    cargarProductosEnDropdown();
}

function cerrarFormularioOferta() {
    document.getElementById('formulario-oferta').style.display = 'none';
}

async function editarOferta(id) {
    // Para editar una oferta, necesitamos obtener el producto asociado
    const { data: productoData, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('descuento_oferta', '>', 0)  // Solo obtener si tiene descuento
        .eq('id', id)
        .single();
    
    if (error || !productoData) {
        // Buscar si el id es del producto directamente
        const { data: prod, error: err } = await supabaseAdmin
            .from('products')
            .select('*')
            .eq('id', id)
            .single();
        
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        ofertaEditar = id;
        document.getElementById('oferta-titulo').textContent = 'Editar Oferta';
        document.getElementById('oferta-producto').value = id;
        document.getElementById('oferta-descuento').value = prod.descuento_oferta || '';
        document.getElementById('formulario-oferta').style.display = 'block';
        cargarProductosEnDropdown();
        return;
    }
    
    ofertaEditar = id;
    document.getElementById('oferta-titulo').textContent = 'Editar Oferta';
    document.getElementById('oferta-producto').value = id;
    document.getElementById('oferta-descuento').value = productoData.descuento_oferta || '';
    document.getElementById('formulario-oferta').style.display = 'block';
    cargarProductosEnDropdown();
}

async function guardarOferta(e) {
    try {
        if (!e || !e.preventDefault) return;
        e.preventDefault();
        
        if (!supabaseAdmin) {
            mostrarNotificacion('Error: Sistema no inicializado', 'error');
            return;
        }
        
        // Obtener elementos
        const productoSelect = document.getElementById('oferta-producto');
        const descuentoInput = document.getElementById('oferta-descuento');
        
        if (!productoSelect || !descuentoInput) {
            mostrarNotificacion('Error: Elementos del formulario no encontrados', 'error');
            return;
        }
        
        const productoId = parseInt(productoSelect.value);
        const descuentoPorcentaje = parseInt(descuentoInput.value) || 0;
        
        if (!productoId || descuentoPorcentaje <= 0 || descuentoPorcentaje > 100) {
            mostrarNotificacion('Debes seleccionar un producto e indicar un descuento válido (1-100%)', 'error');
            return;
        }
        
        console.log('[guardarOferta] Guardando oferta - productoId:', productoId, 'descuento:', descuentoPorcentaje);
        
        // Actualizar el producto con el descuento en la columna descuento_oferta
        const { error: errorProducto } = await supabaseAdmin
            .from('products')
            .update({ descuento_oferta: descuentoPorcentaje })
            .eq('id', productoId);
        
        if (errorProducto) {
            console.error('[guardarOferta] Error actualizando producto:', errorProducto);
            mostrarNotificacion('Error al actualizar producto: ' + errorProducto.message, 'error');
            return;
        }
        
        console.log('[guardarOferta] Oferta guardada exitosamente');
        
        cerrarFormularioOferta();
        cargarOfertas();
        actualizarStats();
        mostrarNotificacion('Oferta guardada correctamente', 'success');
        
    } catch (err) {
        console.error('[guardarOferta] Error:', err);
        mostrarNotificacion('Error inesperado: ' + err.message, 'error');
    }
}

async function eliminarOferta(id) {
    mostrarConfirmacion('¿Estás seguro de que quieres eliminar esta oferta?', async (confirmado) => {
        if (!confirmado) return;
        
        try {
            console.log('[eliminarOferta] Eliminando oferta del producto:', id);
            
            // Actualizar el producto para quitar el descuento (poner descuento_oferta en 0)
            const { error: errorProducto } = await supabaseAdmin
                .from('products')
                .update({ descuento_oferta: 0 })
                .eq('id', id);
            
            if (errorProducto) {
                console.error('[eliminarOferta] Error eliminando oferta:', errorProducto);
                mostrarNotificacion('Error: ' + errorProducto.message, 'error');
                return;
            }
            
            cargarOfertas();
            actualizarStats();
            mostrarNotificacion('Oferta eliminada correctamente', 'success');
        } catch (error) {
            console.error('[eliminarOferta] Error:', error);
            mostrarNotificacion('Error al eliminar oferta', 'error');
        }
    });
}

// ========== GALERÍA ==========

async function cargarGaleria() {
    console.log('[cargarGaleria] Iniciando carga de galería...');
    
    try {
        const { data, error } = await window.supabaseClient
            .from('gallery_slides')
            .select('*')
            .order('orden', { ascending: true });
        
        if (error) {
            console.error('[cargarGaleria] Error al cargar galería:', error);
            mostrarNotificacion('Error al cargar galería: ' + error.message, 'error');
            return;
        }
        
        console.log('[cargarGaleria] Slides cargados:', data.length);
        
        const grid = document.getElementById('galeria-grid');
        if (!grid) {
            console.error('[cargarGaleria] Elemento galeria-grid no encontrado');
            return;
        }
        
        grid.innerHTML = '';
        
        data.forEach(slide => {
            const card = document.createElement('div');
            card.className = 'slide-card';
            card.innerHTML = `
                <img src="${slide.imagen_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjUwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RkZCIvPjwvc3ZnPg=='}" alt="${slide.titulo}" class="slide-imagen">
                <div class="slide-info">
                    <h3>${slide.titulo}</h3>
                    <p>${slide.descripcion || ''}</p>
                    <div class="slide-actions">
                        <button class="btn-editar" onclick="editarSlide(${slide.id})">Editar</button>
                        <button class="btn-eliminar" onclick="eliminarSlide(${slide.id})">Eliminar</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error('[cargarGaleria] Error:', err);
        mostrarNotificacion('Error: ' + err.message, 'error');
    }
}

function abrirFormularioSlide() {
    slideEditar = null;
    
    const tituloEl = document.getElementById('slide-titulo');
    const formEl = document.getElementById('form-slide');
    const activoEl = document.getElementById('slide-activo');
    const formularioEl = document.getElementById('formulario-slide');
    const enlaceEl = document.getElementById('slide-enlace');
    
    if (!tituloEl || !formEl || !activoEl || !formularioEl) {
        console.error('Error: Elementos del formulario de slide no encontrados');
        return;
    }
    
    slideEditar = null;
    tituloEl.textContent = 'Agregar Nuevo Slide';
    formEl.reset();
    activoEl.checked = true;
    
    // Establecer URL base por defecto
    if (enlaceEl) {
        enlaceEl.value = '/productos?categoria=&search=';
    }
    
    // Limpiar preview de imagen
    const previewEl = document.getElementById('slide-imagen-preview');
    if (previewEl) {
        previewEl.innerHTML = '';
    }
    
    // Inicializar zona de subida
    inicializarZonaSubidaSlide();
    
    formularioEl.style.display = 'block';
}

function cerrarFormularioSlide() {
    document.getElementById('formulario-slide').style.display = 'none';
}

function inicializarZonaSubidaSlide() {
    const zonaSubida = document.getElementById('zona-subida-slide');
    const inputFile = document.getElementById('slide-imagen-file');
    
    if (!zonaSubida || !inputFile) return;
    
    // Click en la zona
    zonaSubida.addEventListener('click', () => {
        inputFile.click();
    });
    
    // Cambio de archivo
    inputFile.addEventListener('change', (e) => {
        const archivo = e.target.files[0];
        if (archivo) {
            procesarImagenSlide(archivo);
            inputFile.value = '';
        }
    });
    
    // Drag and drop
    zonaSubida.addEventListener('dragover', (e) => {
        e.preventDefault();
        zonaSubida.style.borderColor = '#720916';
        zonaSubida.style.backgroundColor = '#fff5f5';
    });
    
    zonaSubida.addEventListener('dragleave', () => {
        zonaSubida.style.borderColor = '#d4af37';
        zonaSubida.style.backgroundColor = '#fafaf8';
    });
    
    zonaSubida.addEventListener('drop', (e) => {
        e.preventDefault();
        zonaSubida.style.borderColor = '#d4af37';
        zonaSubida.style.backgroundColor = '#fafaf8';
        
        const archivo = e.dataTransfer.files[0];
        if (archivo && archivo.type.startsWith('image/')) {
            procesarImagenSlide(archivo);
        } else {
            mostrarNotificacion('Por favor arrastra una imagen válida', 'error');
        }
    });
}

async function procesarImagenSlide(archivo) {
    if (!archivo.type.startsWith('image/')) {
        mostrarNotificacion('El archivo debe ser una imagen', 'error');
        return;
    }
    
    try {
        mostrarNotificacion('Subiendo imagen: ' + archivo.name, 'info');
        
        const url = await subirImagen(archivo, 'galeria');
        
        if (url) {
            slideImagenUrl = url;
            mostrarPreviewSlide(url);
            mostrarNotificacion('Imagen agregada correctamente', 'success');
        } else {
            mostrarNotificacion('Error al subir la imagen', 'error');
        }
    } catch (err) {
        console.error('Error procesando imagen:', err);
        mostrarNotificacion('Error al procesar la imagen: ' + err.message, 'error');
    }
}

function mostrarPreviewSlide(url) {
    const previewEl = document.getElementById('slide-imagen-preview');
    if (!previewEl) return;
    
    previewEl.innerHTML = `
        <div style="position: relative; display: inline-block;">
            <img src="${url}" alt="Preview" style="width: 100%; height: auto; border-radius: 8px;">
            <button type="button" class="btn-delete-imagen" onclick="eliminarPreviewSlide()" style="position: absolute; top: 5px; right: 5px; background: #d4af37; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; padding: 0;">×</button>
        </div>
    `;
}

function eliminarPreviewSlide() {
    slideImagenUrl = null;
    const previewEl = document.getElementById('slide-imagen-preview');
    if (previewEl) {
        previewEl.innerHTML = '';
    }
}

async function editarSlide(id) {
    const { data, error } = await window.supabaseClient
        .from('gallery_slides')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    slideEditar = id;
    slideImagenUrl = data.imagen_url || null;
    
    document.getElementById('slide-titulo').textContent = 'Editar Slide';
    document.getElementById('slide-titulo-input').value = data.titulo;
    document.getElementById('slide-descripcion').value = data.descripcion || '';
    document.getElementById('slide-orden').value = data.orden || 1;
    document.getElementById('slide-activo').checked = data.activo;
    
    // Cargar URL del enlace
    const enlaceInput = document.getElementById('slide-enlace');
    if (enlaceInput) {
        enlaceInput.value = data.enlace_url || '/productos';
    }
    
    // Mostrar preview de imagen existente
    if (data.imagen_url) {
        mostrarPreviewSlide(data.imagen_url);
    } else {
        const previewEl = document.getElementById('slide-imagen-preview');
        if (previewEl) {
            previewEl.innerHTML = '';
        }
    }
    
    // Inicializar zona de subida
    inicializarZonaSubidaSlide();
    
    document.getElementById('formulario-slide').style.display = 'block';
}

async function guardarSlide(e) {
    try {
        if (!e || !e.preventDefault) return;
        e.preventDefault();
        
        if (!window.supabaseClient) {
            mostrarNotificacion('Error: Sistema no inicializado', 'error');
            return;
        }
        
        // Obtener elementos
        const tituloInput = document.getElementById('slide-titulo-input');
        const descripcionInput = document.getElementById('slide-descripcion');
        const ordenInput = document.getElementById('slide-orden');
        const activoInput = document.getElementById('slide-activo');
        const enlaceInput = document.getElementById('slide-enlace');
        
        if (!tituloInput || !descripcionInput || !ordenInput || !activoInput) {
            mostrarNotificacion('Error: Elementos del formulario no encontrados', 'error');
            return;
        }
        
        // Usar slideImagenUrl que se carga desde el drag-drop
        let imagenUrl = slideImagenUrl || null;
        
        const datos = {
            titulo: tituloInput.value.trim(),
            descripcion: descripcionInput.value.trim(),
            imagen_url: imagenUrl,
            orden: parseInt(ordenInput.value) || 0,
            activo: activoInput.checked,
            enlace_url: enlaceInput ? enlaceInput.value.trim() : '/productos'
        };
        
        if (!datos.titulo) {
            mostrarNotificacion('El título del slide es obligatorio', 'error');
            return;
        }
        
        if (!imagenUrl) {
            mostrarNotificacion('Por favor selecciona una imagen para el slide', 'error');
            return;
        }
        
        let response;
        
        if (slideEditar) {
            response = await window.supabaseClient
                .from('gallery_slides')
                .update(datos)
                .eq('id', slideEditar);
        } else {
            response = await window.supabaseClient
                .from('gallery_slides')
                .insert([datos]);
        }
        
        if (response.error) {
            mostrarNotificacion('Error: ' + response.error.message, 'error');
            return;
        }
        
        cerrarFormularioSlide();
        cargarGaleria();
        actualizarStats();
        mostrarNotificacion('Slide guardado correctamente', 'success');
    } catch (err) {
        console.error('Error:', err);
        mostrarNotificacion('Error inesperado: ' + err.message, 'error');
    }
}

async function eliminarSlide(id) {
    console.log('[eliminarSlide] Iniciando eliminación de slide:', id);
    
    mostrarConfirmacion('¿Estás seguro de que quieres eliminar este slide?', async (confirmado) => {
        console.log('[eliminarSlide] Confirmación recibida:', confirmado);
        
        if (!confirmado) {
            console.log('[eliminarSlide] Eliminación cancelada');
            return;
        }
        
        try {
            console.log('[eliminarSlide] Ejecutando DELETE para id:', id);
            console.log('[eliminarSlide] window.supabaseClient disponible:', !!window.supabaseClient);
            
            const { data, error } = await window.supabaseClient
                .from('gallery_slides')
                .delete()
                .eq('id', id);
            
            console.log('[eliminarSlide] Respuesta de DELETE - data:', data, 'error:', error);
            
            if (error) {
                mostrarNotificacion('Error: ' + error.message, 'error');
                console.error('[eliminarSlide] Error en DELETE:', error);
                return;
            }
            
            console.log('[eliminarSlide] DELETE exitoso, recargando galería...');
            await cargarGaleria();
            
            console.log('[eliminarSlide] Actualizando estadísticas...');
            await actualizarStats();
            
            mostrarNotificacion('Slide eliminado correctamente', 'success');
            console.log('[eliminarSlide] Eliminación completada');
        } catch (err) {
            mostrarNotificacion('Error: ' + err.message, 'error');
            console.error('[eliminarSlide] Error en try-catch:', err);
        }
    });
}

// ========== STATS ==========

async function actualizarStats() {
    console.log('[actualizarStats] Iniciando actualización de estadísticas');
    console.log('[actualizarStats] supabaseAdmin existe:', !!supabaseAdmin);
    
    try {
        const { count: countProductos } = await supabaseAdmin
            .from('products')
            .select('*', { count: 'exact' });
        console.log('[actualizarStats] countProductos:', countProductos);
        
        // Contar ofertas: productos con descuento_oferta > 0
        const { count: countOfertas } = await supabaseAdmin
            .from('products')
            .select('*', { count: 'exact' })
            .gt('descuento_oferta', 0);
        console.log('[actualizarStats] countOfertas:', countOfertas);
        
        const { count: countGaleria } = await supabaseAdmin
            .from('gallery_slides')
            .select('*', { count: 'exact' });
        console.log('[actualizarStats] countGaleria:', countGaleria);
        
        // Cargar recuento de pedidos desde API
        let countPedidos = 0;
        try {
            console.log('[actualizarStats] Llamando a API de pedidos...');
            const response = await fetch('/api/admin/get-pedidos-count');
            console.log('[actualizarStats] Respuesta de API:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('[actualizarStats] Datos recibidos:', data);
                countPedidos = data.count || 0;
            } else {
                console.error('[actualizarStats] Error en respuesta:', response.status);
            }
        } catch (error) {
            console.error('[actualizarStats] Error al obtener recuento de pedidos:', error);
        }
        
        // Contar mensajes sin leer
        const { count: countMensajesSinLeer } = await supabaseAdmin
            .from('contact_messages')
            .select('*', { count: 'exact' })
            .eq('leido', false);
        console.log('[actualizarStats] countMensajesSinLeer:', countMensajesSinLeer);
        
        // Contar productos sin stock
        const { count: countProductosSinStock } = await supabaseAdmin
            .from('products')
            .select('*', { count: 'exact' })
            .eq('stock', 0);
        console.log('[actualizarStats] countProductosSinStock:', countProductosSinStock);
        
        // Contar pedidos sin enviar (que NO sean 'enviado' o 'entregado')
        const { data: pedidosSinEnviar, count: countPedidosSinEnviar } = await supabaseAdmin
            .from('pedidos')
            .select('*', { count: 'exact' })
            .in('estado', ['pendiente', 'confirmado']);
        console.log('[actualizarStats] countPedidosSinEnviar:', countPedidosSinEnviar);
        
        // Contar usuarios suscritos al newsletter
        const { count: countUsuariosSuscritos } = await supabaseAdmin
            .from('newsletter_subscribers')
            .select('*', { count: 'exact' });
        console.log('[actualizarStats] countUsuariosSuscritos:', countUsuariosSuscritos);
        
        console.log('[actualizarStats] Valores finales:', { countProductos, countOfertas, countGaleria, countPedidos, countMensajesSinLeer, countProductosSinStock, countPedidosSinEnviar, countUsuariosSuscritos });
        
        const statProductos = document.getElementById('stat-productos');
        const statOfertas = document.getElementById('stat-ofertas');
        const statGaleria = document.getElementById('stat-galeria');
        const statPedidos = document.getElementById('stat-pedidos');
        const statUsuariosSuscritos = document.getElementById('stat-usuarios-suscritos');
        const statMensajesSinLeer = document.getElementById('stat-mensajes-sin-leer');
        const statProductosSinStock = document.getElementById('stat-productos-sin-stock');
        const statPedidosSinEnviar = document.getElementById('stat-pedidos-sin-enviar');
        const statPedidosSinEnviarCard = document.getElementById('stat-pedidos-sin-enviar-card');
        
        if (statProductos) statProductos.textContent = countProductos || 0;
        if (statOfertas) statOfertas.textContent = countOfertas || 0;
        if (statGaleria) statGaleria.textContent = countGaleria || 0;
        if (statPedidos) statPedidos.textContent = countPedidos;
        if (statUsuariosSuscritos) statUsuariosSuscritos.textContent = countUsuariosSuscritos || 0;
        if (statMensajesSinLeer) statMensajesSinLeer.textContent = countMensajesSinLeer || 0;
        if (statProductosSinStock) statProductosSinStock.textContent = countProductosSinStock || 0;
        if (statPedidosSinEnviar) statPedidosSinEnviar.textContent = countPedidosSinEnviar || 0;
        
        // Cambiar color de la tarjeta de pedidos sin enviar
        if (statPedidosSinEnviarCard) {
            if (countPedidosSinEnviar === 0) {
                // Verde cuando NO hay pedidos sin enviar (está bien)
                statPedidosSinEnviarCard.innerHTML = `<h3 style="color: #155724 !important;">Pedidos Sin Enviar</h3><p style="color: #28a745 !important; font-size: 2.5em; font-weight: bold;">${countPedidosSinEnviar}</p>`;
                statPedidosSinEnviarCard.style.backgroundColor = '#d4edda !important';
                statPedidosSinEnviarCard.style.borderColor = '#28a745 !important';
                statPedidosSinEnviarCard.style.border = '2px solid #28a745 !important';
            } else {
                // Rojo cuando HAY pedidos sin enviar (está mal)
                statPedidosSinEnviarCard.innerHTML = `<h3 style="color: #721c24 !important;">Pedidos Sin Enviar</h3><p style="color: #dc3545 !important; font-size: 2.5em; font-weight: bold;">${countPedidosSinEnviar}</p>`;
                statPedidosSinEnviarCard.style.backgroundColor = '#f8d7da !important';
                statPedidosSinEnviarCard.style.borderColor = '#f5c6cb !important';
                statPedidosSinEnviarCard.style.border = '2px solid #f5c6cb !important';
            }
        }
        
        console.log('[actualizarStats] Elementos actualizados');
    } catch (error) {
        console.error('[actualizarStats] Error general:', error);
    }
}

// ========== NEWSLETTER ==========

async function loadNewsletterData() {
    try {
        if (!window.supabaseClient) {
            console.error('Supabase client no inicializado');
            return;
        }

        // Cargar suscriptores
        const { data: subscribers, error: subError } = await window.supabaseClient
            .from('newsletter_subscribers')
            .select('*', { count: 'exact' })
            .eq('status', 'activo');
        
        if (subError) {
            console.error('Error cargando suscriptores:', subError);
        } else if (subscribers) {
            document.getElementById('subscriber-count').textContent = subscribers.length;
            renderNewsletterSubscribers(subscribers);
        }
    } catch (error) {
        console.error('Error loading newsletter data:', error);
    }
}

function renderNewsletterSubscribers(subscribers) {
    const tbody = document.getElementById('newsletter-subscribers-tbody');
    
    if (!subscribers || subscribers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No hay suscriptores</td></tr>';
        return;
    }
    
    tbody.innerHTML = subscribers.map(sub => {
        const fecha = new Date(sub.subscribed_at).toLocaleDateString('es-ES') + ' ' + 
                      new Date(sub.subscribed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const badge = sub.status === 'activo' ? '<span style="background: #4CAF50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Activo</span>' : '<span style="background: #ccc; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Inactivo</span>';
        return `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.email}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${badge}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${fecha}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">
                    <button onclick="deleteNewsletterSubscriber('${sub.id}', '${sub.email}')" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');

    // Agregar búsqueda
    const searchInput = document.getElementById('search-suscriptores');
    if (searchInput) {
        searchInput.addEventListener('keyup', () => {
            const filter = searchInput.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const email = row.cells[0].textContent.toLowerCase();
                row.style.display = email.includes(filter) ? '' : 'none';
            });
        });
    }
}

async function deleteNewsletterSubscriber(subscriberId, email) {
    // Crear modal de confirmación estilizado
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <h3 style="margin: 0 0 1rem 0; color: #333;">Eliminar suscriptor</h3>
            <p style="margin: 0 0 2rem 0; color: #666;">¿Estás seguro de que quieres eliminar a <strong>${email}</strong>?</p>
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button id="cancel-delete" style="padding: 0.75rem 1.5rem; background: #ddd; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Cancelar</button>
                <button id="confirm-delete" style="padding: 0.75rem 1.5rem; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Eliminar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Botón cancelar
    document.getElementById('cancel-delete').onclick = () => {
        modal.remove();
    };
    
    // Botón confirmar
    document.getElementById('confirm-delete').onclick = async () => {
        const btn = document.getElementById('confirm-delete');
        btn.disabled = true;
        btn.textContent = 'Eliminando...';
        
        try {
            const { error } = await window.supabaseClient
                .from('newsletter_subscribers')
                .delete()
                .eq('id', subscriberId);
            
            if (error) {
                console.error('Error eliminando suscriptor:', error);
                btn.disabled = false;
                btn.textContent = 'Eliminar';
            } else {
                modal.remove();
                // Recargar datos
                loadNewsletterData();
            }
        } catch (error) {
            console.error('Error:', error);
            btn.disabled = false;
            btn.textContent = 'Eliminar';
        }
    };
}

async function sendNewsletterEmail(e) {
    e.preventDefault();
    
    const subject = document.getElementById('newsletter-subject').value;
    const content = document.getElementById('newsletter-content').value;
    const confirmCheckbox = document.getElementById('confirm-send').checked;
    const button = e.target.querySelector('button[type="submit"]');
    
    if (!confirmCheckbox) {
        mostrarNotificacion('Debes confirmar que deseas enviar el newsletter', 'warning');
        return;
    }
    
    try {
        button.disabled = true;
        button.textContent = 'Enviando...';
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        
        const response = await fetch('/api/send-newsletter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subject: subject,
                htmlContent: content,
                adminEmail: currentUser.email || 'admin@joyeriagaliana.es',
                adminId: currentUser.id
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            mostrarNotificacion(`✅ Newsletter enviado exitosamente a ${result.emailsSent} suscriptores`, 'success');
            
            // Limpiar formulario
            document.getElementById('newsletter-send-form').reset();
            
            // Recargar datos
            loadNewsletterData();
        } else {
            mostrarNotificacion('❌ Error al enviar newsletter: ' + (result.error || 'Error desconocido'), 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('❌ Error al enviar newsletter', 'error');
    } finally {
        button.disabled = false;
        button.textContent = 'Enviar Newsletter';
    }
}

// ========== CONTACTO ==========

let mensajePaginaActual = 1;
let mensajesGlobal = [];

async function loadContactMessages() {
    try {
        if (!window.supabaseClient) {
            console.error('Supabase client no inicializado');
            return;
        }

        const { data: messages, error } = await window.supabaseClient
            .from('contact_messages')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error cargando mensajes:', error);
        } else if (messages) {
            mensajesGlobal = messages;
            mensajePaginaActual = 1;
            renderContactMessages(messages);
        }
    } catch (error) {
        console.error('Error loading contact messages:', error);
    }
}

function renderContactMessages(messages) {
    const tbody = document.getElementById('contacto-tbody');
    
    if (!messages || messages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay mensajes</td></tr>';
        return;
    }
    
    // Paginación: 10 mensajes por página
    const ITEMS_POR_PAGINA = 10;
    const totalPaginas = Math.ceil(messages.length / ITEMS_POR_PAGINA);
    const inicio = (mensajePaginaActual - 1) * ITEMS_POR_PAGINA;
    const fin = inicio + ITEMS_POR_PAGINA;
    const mensajesPagina = messages.slice(inicio, fin);
    
    tbody.innerHTML = mensajesPagina.map(msg => {
        const fecha = new Date(msg.created_at).toLocaleDateString('es-ES') + ' ' + 
                      new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const estadoLeido = msg.leido ? '<span style="background: #4CAF50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Leído</span>' : '<span style="background: #ffa500; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Nuevo</span>';
        const estadoRespondido = msg.respondido ? '<span style="background: #2196F3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Respondido</span>' : '';
        
        return `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${msg.nombre}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;"><a href="mailto:${msg.email}" style="color: #d4af37; text-decoration: none;">${msg.email}</a></td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${msg.asunto}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${fecha}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${estadoLeido} ${estadoRespondido}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">
                    <button onclick="verMensajeContacto('${msg.id}', '${msg.nombre}', '${msg.email}', '${msg.asunto}', \`${msg.mensaje}\`, ${msg.leido})" style="background: #d4af37; color: #333; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">Ver</button>
                </td>
            </tr>
        `;
    }).join('');

    // Renderizar paginación
    renderPaginacionContacto(totalPaginas, 'pagination-contacto', (pagina) => {
        mensajePaginaActual = pagina;
        renderContactMessages(mensajesGlobal);
    });

    // Agregar búsqueda
    const searchInput = document.getElementById('search-contacto');
    if (searchInput) {
        searchInput.addEventListener('keyup', () => {
            const filter = searchInput.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const nombre = row.cells[0].textContent.toLowerCase();
                const email = row.cells[1].textContent.toLowerCase();
                const asunto = row.cells[2].textContent.toLowerCase();
                row.style.display = (nombre.includes(filter) || email.includes(filter) || asunto.includes(filter)) ? '' : 'none';
            });
        });
    }
}

function renderPaginacionContacto(totalPaginas, containerId, onPageChange) {
    const container = document.getElementById(containerId);
    
    if (!container) {
        return;
    }
    
    // Limpiar y crear botones de paginación
    container.innerHTML = '';
    
    // Si no hay suficientes páginas, no mostrar nada
    if (totalPaginas <= 1) {
        return;
    }
    
    // Botón anterior
    if (mensajePaginaActual > 1) {
        const btnAnterior = document.createElement('button');
        btnAnterior.textContent = '← Anterior';
        btnAnterior.style.cssText = 'padding: 0.75rem 1.5rem; background: #d4af37; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
        btnAnterior.onclick = () => onPageChange(mensajePaginaActual - 1);
        container.appendChild(btnAnterior);
    }
    
    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        const btnPage = document.createElement('button');
        btnPage.textContent = i;
        
        if (i === mensajePaginaActual) {
            btnPage.style.cssText = 'padding: 0.75rem 1rem; background: #d4af37; color: white; border: 2px solid #d4af37; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
        } else {
            btnPage.style.cssText = 'padding: 0.75rem 1rem; background: white; color: #d4af37; border: 2px solid #d4af37; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
            btnPage.onclick = () => onPageChange(i);
        }
        
        container.appendChild(btnPage);
    }
    
    // Botón siguiente
    if (mensajePaginaActual < totalPaginas) {
        const btnSiguiente = document.createElement('button');
        btnSiguiente.textContent = 'Siguiente →';
        btnSiguiente.style.cssText = 'padding: 0.75rem 1.5rem; background: #d4af37; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; margin: 0.5rem;';
        btnSiguiente.onclick = () => onPageChange(mensajePaginaActual + 1);
        container.appendChild(btnSiguiente);
    }
}

function verMensajeContacto(id, nombre, email, asunto, mensaje, leido) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        overflow-y: auto;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 2rem; max-width: 600px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); margin: 2rem auto;">
            <h3 style="margin: 0 0 1.5rem 0; color: #333;">Mensaje de Contacto</h3>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="margin: 0 0 0.5rem 0; color: #666; font-weight: 600;">Nombre:</p>
                <p style="margin: 0 0 1rem 0; color: #333;">${nombre}</p>
                
                <p style="margin: 0 0 0.5rem 0; color: #666; font-weight: 600;">Email:</p>
                <p style="margin: 0 0 1rem 0; color: #333;"><a href="mailto:${email}" style="color: #d4af37; text-decoration: none;">${email}</a></p>
                
                <p style="margin: 0 0 0.5rem 0; color: #666; font-weight: 600;">Asunto:</p>
                <p style="margin: 0 0 1rem 0; color: #333;">${asunto}</p>
                
                <p style="margin: 0 0 0.5rem 0; color: #666; font-weight: 600;">Mensaje:</p>
                <p style="margin: 0 0 1rem 0; color: #333; white-space: pre-wrap; line-height: 1.6;">${mensaje}</p>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button id="close-msg" style="padding: 0.75rem 1.5rem; background: #ddd; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Cerrar</button>
                <button onclick="marcarMensajeLeido('${id}')" style="padding: 0.75rem 1.5rem; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Marcar como Leído</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('close-msg').onclick = () => modal.remove();
    
    // Marcar como leído automáticamente
    if (!leido) {
        marcarMensajeLeido(id);
    }
}

async function marcarMensajeLeido(id) {
    try {
        const { error } = await window.supabaseClient
            .from('contact_messages')
            .update({ leido: true })
            .eq('id', id);
        
        if (!error) {
            loadContactMessages();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// ========== DATOS DE VENTAS ==========

let chartVentas = null;

async function cargarDatosVentas() {
    try {
        console.log('[cargarDatosVentas] Iniciando carga de datos...');
        
        // Esperar a que supabaseAdmin esté disponible
        if (!supabaseAdmin) {
            console.log('[cargarDatosVentas] Esperando supabaseAdmin...');
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (supabaseAdmin) {
                        clearInterval(checkInterval);
                        resolve(null);
                    }
                }, 100);
            });
        }
        
        // Obtener token de sesión
        const { data: { session } } = await supabaseAdmin.auth.getSession();
        if (!session) {
            console.error('[cargarDatosVentas] Sin sesión');
            return;
        }

        console.log('[cargarDatosVentas] Token obtenido, llamando API de debug...');
        
        // Primero llamar al endpoint de debug
        const debugResponse = await fetch('/api/admin/debug-sales', {
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            }
        });

        const debugData = await debugResponse.json();
        console.log('[cargarDatosVentas] Debug data:', debugData);

        if (debugData.totalPedidos === 0) {
            console.warn('[cargarDatosVentas] No hay pedidos en la BD');
            // Mostrar 0 en las tarjetas
            const statVentasMes = document.getElementById('stat-ventas-mes');
            if (statVentasMes) statVentasMes.textContent = '€0.00';
            
            const statProductoTop = document.getElementById('stat-producto-top');
            if (statProductoTop) statProductoTop.textContent = '-';
            return;
        }
        
        // Ahora llamar al endpoint principal
        const response = await fetch('/api/admin/get-sales-data', {
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('[cargarDatosVentas] Respuesta API status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[cargarDatosVentas] Error en API:', response.status, errorData);
            return;
        }

        const data = await response.json();
        console.log('[cargarDatosVentas] Datos recibidos:', data);

        // Actualizar tarjeta de ventas del mes
        const statVentasMes = document.getElementById('stat-ventas-mes');
        if (statVentasMes) {
            statVentasMes.textContent = `€${data.ventasDelMes.toFixed(2)}`;
            statVentasMes.style.color = '#2ecc71';
        }

        // Actualizar tarjeta de producto más vendido
        const statProductoTop = document.getElementById('stat-producto-top');
        const statProductoTopCantidad = document.getElementById('stat-producto-top-cantidad');
        if (statProductoTop && data.productoMasVendido) {
            statProductoTop.textContent = data.productoMasVendido.nombre || '-';
            statProductoTop.style.color = '#3498db';
            if (statProductoTopCantidad) {
                statProductoTopCantidad.innerHTML = `<strong>${data.productoMasVendido.cantidad}</strong> unidades vendidas`;
            }
        }

        // Crear gráfico de ventas últimos 7 días
        crearGraficoVentas(data.ventasÚltimos7Días);

    } catch (error) {
        console.error('[cargarDatosVentas] Error:', error);
    }
}

function crearGraficoVentas(datos) {
    try {
        const canvas = document.getElementById('chartVentas7Dias');
        if (!canvas) {
            console.error('[crearGraficoVentas] Canvas no encontrado');
            return;
        }

        // Destruir gráfico anterior si existe
        if (chartVentas) {
            chartVentas.destroy();
        }

        const ctx = canvas.getContext('2d');
        
        // Preparar datos
        const labels = datos.map(d => d.día);
        const valores = datos.map(d => d.total);

        // Crear gradiente
        const gradiente = ctx.createLinearGradient(0, 0, 0, 300);
        gradiente.addColorStop(0, 'rgba(212, 175, 55, 0.3)');
        gradiente.addColorStop(1, 'rgba(212, 175, 55, 0)');

        chartVentas = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas (€)',
                    data: valores,
                    borderColor: '#d4af37',
                    backgroundColor: gradiente,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#d4af37',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#333',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#666',
                            callback: function(value) {
                                return '€' + value.toFixed(0);
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#666'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        console.log('[crearGraficoVentas] Gráfico creado exitosamente');

    } catch (error) {
        console.error('[crearGraficoVentas] Error creando gráfico:', error);
    }
}

// ========== LOGOUT ==========

async function logout() {
    if (!supabaseAdmin) {
        localStorage.removeItem('authSession');
        localStorage.removeItem('currentUser');
        window.location.href = '/admin-login.html';
        return;
    }
    
    try {
        await supabaseAdmin.auth.signOut();
        localStorage.removeItem('authSession');
        localStorage.removeItem('currentUser');
        window.location.href = '/admin-login.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        localStorage.removeItem('authSession');
        localStorage.removeItem('currentUser');
        window.location.href = '/admin-login.html';
    }
}
