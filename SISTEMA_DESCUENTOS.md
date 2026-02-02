# Sistema de Códigos de Descuento - Guía de Implementación

## 📋 Resumen Creado

He creado un sistema completo de gestión de códigos de descuento con:

### 1. Base de Datos (SQL)
**Archivo:** `migrations/create_descuentos_table.sql`

Tabla `descuentos` con los siguientes campos:
- `id` - UUID único
- `codigo` - Código del descuento (ej: NAVIDAD2025)
- `porcentaje` - Porcentaje de descuento (0-100)
- `usos_maximos` - Cantidad máxima de usos (0 = ilimitado)
- `usos_actuales` - Usos realizados hasta ahora
- `activo` - Estado del descuento
- `fecha_inicio` - Cuándo se activa
- `fecha_fin` - Cuándo vence (opcional)
- `descripcion` - Texto descriptivo
- `created_at` / `updated_at` - Timestamps

**Seguridad:** Incluye Row Level Security (RLS) para:
- Admins: pueden hacer cualquier operación
- Usuarios: solo ven descuentos activos y vigentes

---

## 🎨 Panel Admin

### Panel de Control
**Ubicación:** Nuevo menú "Descuentos" en el panel admin

**Funcionalidades:**
- ✅ Crear nuevos códigos de descuento
- ✅ Editar códigos existentes
- ✅ Ver lista completa de descuentos
- ✅ Buscar por código
- ✅ Ver estado (activo/inactivo)
- ✅ Ver disponibilidad (usos restantes)
- ✅ Ver fecha de vencimiento
- ✅ Eliminar descuentos

**Formulario incluye:**
- Código (mayúsculas automáticas)
- Porcentaje de descuento
- Usos máximos (0 = ilimitado)
- Fecha de vencimiento
- Descripción
- Checkbox de estado activo

---

## 📱 Archivos Creados/Modificados

### Nuevos archivos:
1. **`migrations/create_descuentos_table.sql`** - Tabla y políticas RLS
2. **`public/js/descuentos-admin.js`** - Funciones del panel admin
3. **`public/js/descuentos.js`** - Funciones para aplicar descuentos

### Archivos modificados:
1. **`public/admin-panel.html`** - Añadidos:
   - Link en navegación lateral
   - Sección HTML con formulario
   - Tabla de descuentos
   - Script de descuentos-admin.js

---

## 🔧 Pasos para Implementar

### Paso 1: Ejecutar la migración SQL
```sql
-- En tu consola Supabase, ejecuta:
-- Copia el contenido de migrations/create_descuentos_table.sql
-- y pégalo en el editor SQL de Supabase
```

**Acceso:** 
- Ve a tu proyecto en [supabase.com](https://app.supabase.com)
- Selecciona tu proyecto
- Ve a "SQL Editor"
- Crea una nueva query
- Pega el contenido de `create_descuentos_table.sql`
- Ejecuta (Play)

### Paso 2: Verificar que los archivos existan
```bash
# Verifica que estos archivos estén en su lugar:
- public/js/descuentos-admin.js ✓
- public/js/descuentos.js ✓
- public/admin-panel.html (modificado) ✓
```

### Paso 3: Integración en Checkout (opcional)
Si quieres aplicar descuentos en el checkout, puedes usar:

```javascript
// En tu archivo de checkout (ejemplo):
// Aplicar descuento
const resultado = await aplicarCodigo('NAVIDAD2025');

if (!resultado.error) {
    // Descuento válido
    const montos = calcularDescuento(subtotal, resultado.porcentaje);
    console.log('Descuento:', montos.descuento);
    console.log('Total con descuento:', montos.final);
    
    // Registrar el uso
    await registrarUsoDescuento(resultado.id);
} else {
    // Mostrar error
    alert(resultado.error);
}
```

---

## 📊 Ejemplo de Uso en el Panel Admin

### Crear un código:
1. Click en "Descuentos" en la barra lateral
2. Click en "+ Nuevo Descuento"
3. Completa:
   - Código: `NAVIDAD2025`
   - Porcentaje: `15`
   - Usos Máximos: `100` (o 0 para ilimitado)
   - Fecha Vencimiento: `31/12/2025`
   - Descripción: `Oferta especial de Navidad`
4. Click en "Guardar Descuento"

### Ver estado:
La tabla muestra automáticamente:
- ✓ Activo - si está disponible
- ✕ Inactivo - si venció, se acabó, o está desactivado

---

## 🎯 Características

### Para Administrador:
- Control total sobre códigos
- Ver cuántas veces se ha usado cada código
- Limitar uso por cantidad
- Establecer fecha de vencimiento
- Activar/desactivar códigos
- Búsqueda rápida

### Para Cliente:
- Validación automática de código
- Ver si es válido y disponible
- Error claro si algo está mal
- Descuento aplicado automáticamente

### Seguridad:
- RLS (Row Level Security) en la tabla
- Solo admins pueden crear/editar
- Códigos únicos (no se repiten)
- Validación de porcentaje (0-100)
- Validación de fechas

---

## 💡 Próximos Pasos (Opcionales)

Si quieres completar la integración:

1. **Integrar en Carrito/Checkout:**
   - Añadir input para código
   - Llamar a `aplicarCodigo()`
   - Mostrar descuento en resumen

2. **Mostrar Descuentos Disponibles:**
   - Usar `obtenerDescuentosActivos()`
   - Mostrar en homepage o modal

3. **Email con Códigos:**
   - Crear códigos especiales por email
   - Enviar vía newsletter

4. **Estadísticas:**
   - Dashboard con descuentos más usados
   - Ingresos perdidos por descuentos
   - Códigos próximos a vencer

---

## 📝 SQL de la Tabla (Referencia)

```sql
CREATE TABLE descuentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    porcentaje DECIMAL(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
    usos_maximos INTEGER NOT NULL DEFAULT 0,
    usos_actuales INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## ✅ Checklist

- [ ] Ejecuté la migración SQL en Supabase
- [ ] El menú "Descuentos" aparece en el panel admin
- [ ] Puedo crear un nuevo código de descuento
- [ ] La tabla muestra los códigos correctamente
- [ ] Puedo editar/eliminar códigos
- [ ] La búsqueda funciona
- [ ] Los códigos se marcan como "Activo/Inactivo" correctamente
- [ ] Integré en checkout si lo necesitaba

---

¡Listo! Tu sistema de descuentos está configurado. 🎉
