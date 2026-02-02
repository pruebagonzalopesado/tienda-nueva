# SISTEMA DE TALLAS PARA ANILLOS - GUÍA DE IMPLEMENTACIÓN

## ✅ Implementación Completada

Se ha implementado un sistema completo de tallas para anillos en tu tienda. Los clientes pueden seleccionar cualquier talla disponible (6-22) mientras haya stock general en el producto.

---

## 📋 CAMBIOS EN LA BASE DE DATOS

### 1. **Migración SQL: `create_ring_sizes_table.sql`**
Se creó la migración en `/tienda/migrations/create_ring_sizes_table.sql` que incluye:

- **Tabla `ring_sizes`**: Almacena las tallas disponibles (6-22)
  ```sql
  CREATE TABLE ring_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    size_number INTEGER NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

- **Columna `has_sizes` en tabla `products`**: Indica si el anillo usa sistema de tallas
  ```sql
  ALTER TABLE products ADD COLUMN has_sizes BOOLEAN DEFAULT FALSE;
  ```

### 2. **Ejecución de la Migración**
Necesitas ejecutar esta migración en tu base de datos Supabase:
1. Ve a tu proyecto en Supabase
2. Abre el SQL Editor
3. Copia y pega el contenido de `migrations/create_ring_sizes_table.sql`
4. Ejecuta la migración

---

## 💻 CAMBIOS EN EL FRONTEND

### 1. **Panel Admin** (`public/admin-panel.html` y `public/js/admin.js`)

#### Formulario de Productos:
- Se agregó un checkbox "Este anillo usa sistema de tallas (6-22)" que aparece **solo** para productos de la categoría "Anillos"
- Cuando está marcado, indica que este anillo permite seleccionar talla
- El stock se mantiene a nivel de producto (no por talla)

#### Nuevas funciones en `admin.js`:
```javascript
// Mostrar/ocultar sección según categoría
mostrarSeccionTallas(categoria)

// Guardar estado de tallas en el producto
guardarUsaTallasProducto(productId, usaTallas)
```

---

### 2. **Página de Detalle del Producto** (`src/pages/productos/[id].astro` y `public/js/product-detail.js`)

#### HTML:
- Se agregó selector visual de tallas (solo para Anillos)
- Los botones de talla muestran números del 6 al 22
- Todos los botones están disponibles (sin restricción de stock por talla)
- Seleccionar una talla actualiza su color de fondo (dorado)

#### Funcionalidad JavaScript:
```javascript
// Cargar todas las tallas disponibles (6-22)
loadRingSizes(productId)

// Renderizar grid de tallas
renderSizeSelector()

// Seleccionar talla
selectSize(btn, sizeId)

// Ocultar selector si no es anillo
hideSizeSelector()
```

- **Validación**: Si el anillo tiene tallas, es obligatorio seleccionar una antes de agregar al carrito
- **Almacenamiento**: La talla seleccionada se guarda en `localStorage` con el carrito
- **Sin restricción**: Todos los clientes pueden pedir cualquier talla mientras haya stock general

---

### 3. **Carrito** (`public/js/carrito.js`)

#### Cambios:
- Se muestra la talla seleccionada debajo del nombre del producto
- Si hay varias tallas del mismo anillo, se pueden agregar como ítems separados en el carrito

---

## 🛒 FLUJO COMPLETO

### Para Admin (crear/editar anillo con tallas):
1. Ir al panel admin
2. Crear/editar producto
3. Seleccionar categoría "Anillos"
4. Aparece checkbox "Este anillo usa sistema de tallas"
5. Marcar el checkbox para habilitar tallas
6. Ingresar stock general del anillo
7. Guardar producto
8. ✅ El anillo ahora permite seleccionar tallas

### Para Cliente (comprar anillo):
1. Ver producto de anillo
2. Se muestra grid de tallas (6-22)
3. Seleccionar una talla (todas disponibles)
4. Indicar cantidad
5. Agregar al carrito
6. ✅ La talla aparece en el carrito
7. En checkout, los datos incluyen la talla
8. ✅ Se guarda en el pedido (tabla `pedidos`, columna `items` como JSON)

---

## 📊 DATOS ALMACENADOS

### En `products`:
```json
{
  "id": 123,
  "nombre": "Anillo Elegante",
  "precio": 59.99,
  "stock": 10,
  "has_sizes": true
}
```

### En `pedidos` (columna `items`):
```json
[
  {
    "id": 123,
    "nombre": "Anillo Elegante",
    "precio": 59.99,
    "cantidad": 1,
    "talla": "14",
    "tallaId": "uuid-de-la-talla",
    "imagen": "url-imagen.jpg"
  }
]
```

---

## 🎯 PUNTOS CLAVE

✅ **Solo Anillos**: El sistema de tallas aparece solo para la categoría "Anillos"
✅ **Opcional**: Puedes crear anillos con o sin tallas (compatible hacia atrás)
✅ **Validación**: Obliga a seleccionar talla en el carrito si el anillo la tiene
✅ **Tallas 6-22**: Todas disponibles para cualquier cliente
✅ **Stock General**: Cada anillo tiene un stock general (no por talla)
✅ **Información en Pedidos**: La talla se guarda con el pedido para referencia del envío

---

## 🚀 PRÓXIMOS PASOS

1. **Ejecutar la migración** en Supabase
2. **Recargar el panel admin** para ver los cambios
3. **Crear un anillo de prueba** y marcar "usa tallas"
4. **Probar el flujo** de compra completo

---

## 📝 NOTAS

- Las tallas predefinidas (6-22) se insertan automáticamente en la migración
- El stock se mantiene a nivel de producto (no por talla)
- El carrito soporta múltiples instancias del mismo anillo con diferentes tallas
- Los datos históricos de pedidos mantienen compatibilidad
- Cualquier cliente puede pedir cualquier talla mientras haya stock general

