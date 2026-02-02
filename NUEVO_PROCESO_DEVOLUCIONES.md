# Nuevp Proceso de Devoluciones - Resumen de Cambios

## 📋 Descripción General
Se ha implementado un nuevo sistema de devoluciones más robusto que ya no reembolsa automáticamente al usuario cuando solicita una devolución. Ahora el flujo es:

1. **Usuario solicita devolución** → Se abre modal pidiendo motivo
2. **Admin revisa** → Puede confirmar o rechazar
3. **Se envía email** según el estado (procesado, confirmada o rechazada)

---

## 🔧 Cambios Técnicos Realizados

### 1. **Migración de Base de Datos**
**Archivo:** `/migrations/create_devoluciones_table.sql`

Creada nueva tabla `devoluciones` con:
- `id`: PK auto-generado
- `pedido_id`: FK a tabla pedidos
- `usuario_email`: Email del cliente
- `usuario_nombre`: Nombre del cliente
- `motivo_solicitud`: Motivo de la devolución (requerido, min 10 caracteres)
- `estado`: 'procesado' | 'confirmada' | 'rechazada'
- `motivo_rechazo`: Opcional, solo si estado es 'rechazada'
- `created_at` / `updated_at`: Timestamps
- Índices para búsquedas rápidas
- RLS (Row Level Security) habilitado

### 2. **Frontend - Modal de Devolución**
**Archivo:** `/src/pages/mis-compras.astro`

**Cambios:**
- Modal ahora pide **motivo de devolución** (textarea)
- Validación: mínimo 10 caracteres
- Mensaje de éxito actualizado: "tu devolución está en proceso"
- Botón ahora dice "Enviar Solicitud" en lugar de "Sí, Solicitar Devolución"

**Funciones modificadas:**
- `solicitarDevolucionConfirmar()` - igual
- `confirmarDevolucion()` - valida el motivo antes de enviar
- `procesarDevolucion(pedidoId, email, nombre, motivo)` - envía motivo al servidor

### 3. **API: request-return**
**Archivo:** `/src/pages/api/request-return.ts`

**Cambio principal:** Ya NO procesa el reembolso automáticamente

**Nuevos pasos:**
1. ✅ Valida el motivo (mín 10 caracteres)
2. ✅ Actualiza estado del pedido a `devolucion_proceso`
3. ✅ **Crea registro en tabla `devoluciones` con estado "procesado"**
4. ✅ Genera PDF de devolución
5. ✅ **Envía email "Devolución en Proceso"** (no reembolso)
6. ❌ NO procesa reembolso en Stripe (lo hace el admin después)

**Email enviado al cliente:**
- Estado: "⏳ Devolución en Proceso"
- Se informan los próximos pasos
- Se adjunta nota de referencia

### 4. **API Admin: manage-returns (NUEVA)**
**Archivo:** `/src/pages/api/admin/manage-returns.ts`

**Acciones disponibles:**

#### a) `listar` - Obtiene todas las devoluciones
```typescript
POST /api/admin/manage-returns
{ action: 'listar' }
```
Retorna array de devoluciones con los datos del pedido asociado.

#### b) `confirmar` - Confirma y procesa reembolso
```typescript
POST /api/admin/manage-returns
{ devolucionId: number, action: 'confirmar' }
```
**Pasos:**
1. Procesa reembolso en Stripe (usando Payment Intent)
2. Actualiza estado a `confirmada`
3. **Envía email "Devolución Confirmada y Reembolso en Proceso"**

**Email enviado:**
- Título: "✅ Devolución Confirmada"
- Info: "Reembolso en Proceso" (5-10 días hábiles)
- Incluye detalles de la devolución

#### c) `rechazar` - Rechaza la devolución
```typescript
POST /api/admin/manage-returns
{ devolucionId: number, action: 'rechazar', motivo_rechazo: string }
```
**Pasos:**
1. Actualiza estado a `rechazada` + guarda motivo
2. **Envía email "Devolución Rechazada"**

**Email enviado:**
- Título: "❌ Devolución Rechazada"
- Incluye motivo del rechazo
- Invita al cliente a contactar si tiene dudas

### 5. **Panel Admin - Nueva Sección de Devoluciones**
**Archivo:** `/src/pages/admin/pedidos.astro`

**Nuevos elementos:**
- Botón en sidebar: "↩️ Devoluciones"
- Nueva sección con tabla de devoluciones
- Filtros por:
  - Búsqueda: email o ID de pedido
  - Estado: Procesado | Confirmada | Rechazada

**Interfaz de Gestión:**
- Tabla muestra: ID, Pedido, Cliente, Email, Motivo (truncado), Estado, Fecha
- Botón "Gestionar" abre modal con opciones:
  - **✅ Confirmar Devolución** (verde)
  - **❌ Rechazar Devolución** (rojo)
  
**Modal de Rechazo:**
- Permite escribir motivo del rechazo
- Validación: campo obligatorio
- Confirmación antes de enviar

---

## 📧 Templates de Email

### Template 1: "Devolución en Proceso"
Enviado cuando: Usuario solicita devolución
- Color: Oro/Dorado (#d4af37)
- Mensaje: "Tu solicitud está siendo procesada"
- Próximos pasos enumerados
- Adjunta PDF de referencia

### Template 2: "Devolución Confirmada y Reembolso en Proceso"
Enviado cuando: Admin confirma la devolución
- Color: Verde (#28a745)
- Mensaje: "Reembolso iniciado"
- Timing: 5-10 días hábiles
- Detalles de la devolución

### Template 3: "Devolución Rechazada"
Enviado cuando: Admin rechaza la devolución
- Color: Rojo (#f44336)
- Mensaje: Motivo del rechazo
- Invita a contactar para más info

---

## 🔄 Flujo Completo de Devolución

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENTE SOLICITA DEVOLUCIÓN                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
         [Modal: Motivo Requerido]
                 │
                 ▼
         POST /api/request-return
         - Valida motivo (min 10 chars)
         - Crea registro en `devoluciones` (estado: "procesado")
         - Actualiza pedido a "devolucion_proceso"
         - ENVÍA EMAIL: "Devolución en Proceso"
                 │
                 ▼
        ┌─────────────────────────────┐
        │ ADMIN REVISA EN PANEL       │
        └─────────────────────────────┘
         ↓                           ↓
    [CONFIRMAR]                 [RECHAZAR]
         │                           │
         ▼                           ▼
POST /admin/manage-returns    POST /admin/manage-returns
  action: 'confirmar'          action: 'rechazar'
         │                           │
         ├─ Procesa reembolso        ├─ Valida motivo
         ├─ Estado: confirmada       ├─ Estado: rechazada
         ├─ EMAIL:                   ├─ EMAIL:
         │  ✅ Confirmada            │  ❌ Rechazada
         └─ Reembolso en proceso     └─ Motivo explicado
```

---

## 🔐 Seguridad

- RLS habilitado en tabla `devoluciones`
- Solo usuarios pueden ver sus propias devoluciones
- Solo admin puede cambiar estado de devoluciones
- Validación de email en ambos lados (cliente y servidor)
- Motivo de rechazo obligatorio para rechazos

---

## 📝 Notas Importantes

1. **El reembolso SE PROCESA en el momento en que el admin CONFIRMA**, no cuando el usuario solicita
2. **No se restaura stock automáticamente** (se requiere revisión manual del admin)
3. **Los emails son transaccionales** y clave en el flujo - asegúrate que Brevo está configurado
4. **La tabla de devoluciones tiene histórico completo** para auditoría
5. **Estado "procesado" es solo transicional** - debe pasar a confirmada o rechazada

---

## ✅ Checklist de Implementación

- [x] Migración SQL creada
- [x] Frontend: Modal con motivo
- [x] API: request-return actualizada (sin reembolso automático)
- [x] API: manage-returns creada (listar, confirmar, rechazar)
- [x] Admin Panel: Nueva sección de devoluciones
- [x] Emails: 3 templates implementados
- [x] Validaciones implementadas
- [x] RLS configurado

---

## 🚀 Próximos Pasos

1. **Ejecutar la migración SQL** en Supabase
2. **Probar el flujo completo** en staging
3. **Verificar emails** en Brevo
4. **Capacitar al admin** sobre las nuevas opciones
5. **Considerar automatización** de notificaciones al cliente sobre instrucciones de envío

---

**Fecha:** 20 de enero de 2026
**Estado:** ✅ Completado
