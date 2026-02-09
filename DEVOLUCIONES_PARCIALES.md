# Sistema de Devoluciones Parciales - Implementación Completada

## 📋 Resumen de los Cambios Realizados

Se ha implementado un **sistema de devoluciones parciales** que permite a los clientes devolver solo los productos que deseen de un pedido, con reembolsos proporcionales automáticos en Stripe.

---

## 🔄 Cambios Técnicos Implementados

### 1. **Base de Datos - Nueva Migración**
**Archivo:** `/migrations/add_items_to_devoluciones.sql`

Se agregaron dos nuevas columnas a la tabla `devoluciones`:
- `items_devueltos` (JSONB): Almacena el array de items específicos seleccionados para devolver
- `monto_reembolso` (DECIMAL): Almacena el monto exacto a reembolsar basado en los items

También se eliminó la restricción UNIQUE para permitir múltiples devoluciones del mismo pedido (parciales).

**Para aplicar:**
```bash
psql -U tu_usuario -d tu_base_datos -f migrations/add_items_to_devoluciones.sql
```

---

### 2. **Frontend - Modal de Selección de Productos**
**Archivo:** `/src/pages/mis-compras.astro`

#### Cambios:
- ✅ Modal ahora muestra lista de todos los productos del pedido
- ✅ Checkboxes para seleccionar cuáles devolver
- ✅ Cálculo en tiempo real del monto a reembolsar
- ✅ Validación: mínimo 1 producto debe estar seleccionado
- ✅ Muestra el monto exacto a reembolsar antes de confirmar

#### Nuevas funciones JavaScript:
- `solicitarDevolucionConfirmar()` - Carga los items del pedido en el modal
- `actualizarMontoReembolso()` - Calcula el monto dinámicamente
- `obtenerItemsSeleccionados()` - Obtiene solo los items checked
- `procesarDevolucion(..., itemsDevueltos)` - Envía items seleccionados

---

### 3. **API: request-return.ts - Devoluciones Parciales**
**Archivo:** `/src/pages/api/request-return.ts`

#### Cambios principales:
- ✅ Ahora recibe `itemsDevueltos` como parámetro
- ✅ Calcula automáticamente el `monto_reembolso` basado en items
- ✅ Previene múltiples devoluciones activas del mismo pedido
- ✅ Genera PDF solo con items devueltos
- ✅ Email muestra detalles de cada item y monto exacto

#### Request body actualizado:
```json
{
  "pedidoId": 123,
  "email": "cliente@example.com",
  "nombre": "Juan",
  "motivo": "El producto no cumple con mis expectativas",
  "itemsDevueltos": [
    {
      "product_id": "abc123",
      "nombre": "Anillo de Oro",
      "cantidad": 1,
      "precio": 150.00,
      "subtotal": 150.00,
      "talla": "18"
    },
    {
      "product_id": "def456",
      "nombre": "Pulsera",
      "cantidad": 2,
      "precio": 50.00,
      "subtotal": 100.00
    }
  ]
}
```

---

### 4. **API: manage-returns.ts - Reembolsos Proporcionales**
**Archivo:** `/src/pages/api/admin/manage-returns.ts`

#### Cambios principales:
- ✅ Lee `items_devueltos` y `monto_reembolso` de la BD
- ✅ Procesa reembolso PROPORCIONAL en Stripe (no del 100%)
- ✅ Calcula el monto en céntimos correctamente: `Math.round(montoReembolso * 100)`
- ✅ Email confirmación muestra lista de items y monto exacto

#### Ejemplo de reembolso:
```
Pedido original: €300 (3 artículos)
Items seleccionados para devolver: €150 (1-2 artículos)
Reembolso en Stripe: €150 exactos
```

---

## 📧 Cambios en Emails

### Email de Solicitud (procesarDevolucion)
Ahora incluye:
- 📦 Lista de productos a devolver
- 💰 Monto exacto a reembolsar
- ⏳ Estado: "en proceso"

### Email de Confirmación (Admin)
Ahora incluye:
- 📦 Lista de productos confirmados para devolución
- 💰 Monto exacto reembolsado (ej: €150.00)
- ✅ Estado: "Confirmada"

---

## 🧪 Prueba de Funcionamiento

### Flujo del Cliente:
1. Va a "Mis Compras" → Pedido entregado (menos de 15 días)
2. Hace click en "Solicitar Devolución"
3. **NUEVO:** Modal abre mostrando todos los productos del pedido
4. **NUEVO:** Selecciona qué productos devolver (checkboxes)
5. **NUEVO:** Ve el cálculo en tiempo real del monto
6. Ingresa el motivo (mínimo 10 caracteres)
7. Envía: Se registra devolución parcial

### Flujo del Admin:
1. Va a Admin → Gestionar Devoluciones
2. Ve la solicitud con los items seleccionados
3. Hace click en "Confirmar"
4. **NUEVO:** Stripe procesa reembolso PROPORCIONAL (solo del monto seleccionado)
5. Usuario recibe email con confirmación y monto exacto

---

## 💾 Datos de la Devolución

Ahora en la tabla `devoluciones` se guarda:

```json
{
  "id": 42,
  "pedido_id": 123,
  "usuario_email": "cliente@example.com",
  "usuario_nombre": "Juan Pérez",
  "motivo_solicitud": "El producto no cumple con mis expectativas",
  "estado": "procesado",
  "items_devueltos": [
    {
      "product_id": "abc123",
      "nombre": "Anillo de Oro",
      "cantidad": 1,
      "precio": 150.00,
      "subtotal": 150.00,
      "talla": "18"
    }
  ],
  "monto_reembolso": 150.00,
  "created_at": "2026-02-09T10:30:00Z",
  "updated_at": "2026-02-09T10:30:00Z"
}
```

---

## ⚠️ Notas Importantes

### Para clientes:
- ✅ Pueden devolver cualquier cantidad de artículos del mismo pedido
- ✅ El reembolso es proporcional solo a los artículos seleccionados
- ✅ Los gastos de envío NO se devuelven en devoluciones parciales
- ✅ Máximo 15 días desde la entrega para solicitar

### Para admin:
- ✅ Ver exactamente qué items se devuelven
- ✅ Reembolso automático proporcional en Stripe
- ✅ Emails informativos con detalles completos
- ✅ Auditoría completa en BD de qué se devolvió

### Consideraciones técnicas:
- ✅ Los JSON en los atributos data se codifican/decodifican correctamente
- ✅ Prevención de múltiples devoluciones activas del mismo pedido
- ✅ Cálculo correcto de céntimos para Stripe (`Math.round(monto * 100)`)
- ✅ Compatibilidad con devoluciones previas al cambio

---

## 🚀 Próximos Pasos (Opcionales)

1. **Devoluciones parciales + parciales**: Permitir una segunda devolución del mismo pedido
2. **Deshabilitar envío**: No reembolsar el envío si quedó menos del 50% del pedido
3. **Etiqueta de retorno**: Generar código QR con etiqueta de envío
4. **Estadísticas**: Dashboard de devoluciones por producto/cliente
5. **Notificaciones SMS**: Alertar al cliente cuando su devolución es confirmada

---

## 📞 Soporte

Si hay problemas:
1. Verifica que la migración SQL se aplicó: `SELECT items_devueltos, monto_reembolso FROM devoluciones LIMIT 1;`
2. Revisa los logs de API en `request-return.ts` y `manage-returns.ts`
3. Valida que los checkboxes se cargan correctamente en el modal
4. Prueba con un pedido de prueba antes de lanzar en producción
