-- =============================================================================
-- CLEANUP RLS - Eliminar políticas inseguras y duplicadas
-- Fecha: 2026-02-18
-- =============================================================================
-- Este script elimina las políticas antiguas inseguras que quedan en la BD
-- =============================================================================

-- ============================================================================
-- PASO 1: ELIMINAR POLÍTICAS INSEGURAS DE DESCUENTOS
-- ============================================================================

-- Eliminar política que permite actualizar sin restricción
DROP POLICY IF EXISTS "Actualizar descuentos sin restricción" ON descuentos;

-- Eliminar política que permite actualizar usos sin restricción
DROP POLICY IF EXISTS "Actualizar usos sin restricción" ON descuentos;

-- Eliminar política antigua duplicada de lectura
DROP POLICY IF EXISTS "Los usuarios pueden ver descuentos activos" ON descuentos;

-- Eliminar política que permite insertar descuentos desde público
DROP POLICY IF EXISTS "Public puede insertar descuentos para newsletter" ON descuentos;

-- Eliminar política antigua duplicada de gestión
DROP POLICY IF EXISTS "Los admins pueden gestionar descuentos" ON descuentos;

-- ============================================================================
-- PASO 2: ELIMINAR POLÍTICAS INSEGURAS DE DEVOLUCIONES
-- ============================================================================

-- Eliminar política que permite TODO
DROP POLICY IF EXISTS "devoluciones_allow_all" ON devoluciones;

-- ============================================================================
-- PASO 3: VERIFICAR ESTADO FINAL
-- ============================================================================

-- Después de ejecutar, verifica que solo quedan estas políticas:
-- 
-- DESCUENTOS (5 políticas seguras):
-- 1. "Admins ven todos los descuentos"
-- 2. "Solo admins pueden actualizar descuentos"
-- 3. "Solo admins pueden crear descuentos"
-- 4. "Solo admins pueden eliminar descuentos"
-- 5. "Usuarios ven descuentos activos"
--
-- DEVOLUCIONES (4 políticas seguras):
-- 1. "Admins pueden procesar devoluciones"
-- 2. "Devoluciones no se crean desde cliente"
-- 3. "Solo admins pueden eliminar devoluciones"
-- 4. "Usuarios ven sus propias devoluciones"
--

-- Ejecuta esto para verificar:
/*
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('descuentos', 'devoluciones')
ORDER BY tablename, policyname;
*/

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
