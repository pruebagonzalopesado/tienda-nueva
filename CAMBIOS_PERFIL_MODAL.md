# Cambios en el Modal de Perfil - Sincronización con API

## Problema Original
El modal "Mi Perfil" solo estaba rellenando 2 campos (nombre y email) desde `localStorage`, mientras que `checkout.js` demostraba que era posible cargar **7 campos completos** (nombre, email, telefono, direccion, ciudad, codigo_postal, pais) desde la base de datos.

## Solución Implementada

### 1. **perfil-modal.js** - Carga datos desde API
- ✅ Modificado para hacer **llamada asincrónica a `/api/get-user-profile`** cuando se abre el modal
- ✅ Rellena **TODOS los 7 campos** desde la respuesta de la API:
  - nombre
  - apellido
  - email
  - telefono
  - direccion
  - ciudad
  - codigo_postal
  - pais
- ✅ Incluye fallback a localStorage en caso de error en la API
- ✅ Muestra "Cargando datos..." mientras obtiene la información

### 2. **Modal HTML** - Agregado campo País
- ✅ Agregado campo de entrada `<input id="perfil-pais">` para capturar el país del usuario

### 3. **update-user-profile.ts** - API acepta país
- ✅ Modificado para aceptar parámetro `pais` en la solicitud POST
- ✅ Guarda el país en la base de datos cuando se actualiza el perfil
- ✅ Incluye campo `pais` en el objeto de actualización de Supabase

## Cambios de Archivos

### `/tienda/public/js/perfil-modal.js`
```javascript
// Antes: Solo leía localStorage
const nombreInput = document.getElementById('perfil-nombre');
if (nombreInput) nombreInput.value = currentUserData.nombre || '';

// Ahora: Llama a API y rellena todos los campos
const response = await fetch(`/api/get-user-profile?id=${currentUserData.id}`);
const result = await response.json();
if (result.success && result.user) {
    nombreInput.value = result.user.nombre || '';
    // ... más 7 campos adicionales
}
```

### `/tienda/src/pages/api/update-user-profile.ts`
```typescript
// Antes: 
const { id, nombre, apellido, telefono, direccion, ciudad, codigo_postal } = body;

// Ahora:
const { id, nombre, apellido, telefono, direccion, ciudad, codigo_postal, pais } = body;

// Y en la actualización:
.update({
    // ... otros campos
    pais: pais.trim() || null,
    updated_at: new Date().toISOString()
})
```

## Flujo Actual

1. **Usuario click "Mi Perfil"** → Modal se abre
2. **Modal llama `/api/get-user-profile?id=USER_ID`** → Obtiene datos completos de la BD
3. **Respuesta exitosa** → Rellena automáticamente los 8 campos del formulario
4. **Usuario edita campos** → Puede cambiar cualquier valor
5. **Click "Guardar Cambios"** → Se envían todos los datos a `/api/update-user-profile`
6. **API actualiza BD** → Los cambios se guardan en la tabla `usuarios`

## Validación

✅ Sintaxis JavaScript verificada en ambos archivos
✅ API endpoints funcionando correctamente
✅ Estructura de campos completa
✅ Fallback a localStorage si hay error de API

## Próximos Pasos Opcionales
- [ ] Agregar validación de formato de teléfono
- [ ] Agregar lista desplegable de países en lugar de input de texto
- [ ] Mostrar confirmación visual cuando se actualiza correctamente
- [ ] Cachear datos del usuario después de cargar desde API

