-- =============================================================================
-- FIX RLS SECURITY - Joyería Galiana
-- Fecha: 2026-02-18
-- =============================================================================
-- Este script corrige las vulnerabilidades de Row Level Security en:
-- 1. Tabla descuentos - permitía a cualquiera actualizar usos
-- 2. Tabla devoluciones - no tenía policies de seguridad
-- =============================================================================

-- ============================================================================
-- PARTE 1: REPARAR TABLA DESCUENTOS
-- ============================================================================

-- PASO 1: LIMPIAR TODAS LAS POLÍTICAS ANTIGUAS E INSEGURAS
-- Esto PERMITE que cualquiera actualice los usos sin restricción
DROP POLICY IF EXISTS "Cualquiera puede actualizar usos" ON descuentos;
DROP POLICY IF EXISTS "Actualizar descuentos sin restricción" ON descuentos;
DROP POLICY IF EXISTS "Actualizar usos sin restricción" ON descuentos;
DROP POLICY IF EXISTS "Los usuarios pueden ver descuentos activos" ON descuentos;
DROP POLICY IF EXISTS "Public puede insertar descuentos para newsletter" ON descuentos;
DROP POLICY IF EXISTS "Los admins pueden gestionar descuentos" ON descuentos;

-- PASO 1b: LIMPIAR LAS NUEVAS POLÍTICAS SI EXISTEN (para re-ejecución segura)
DROP POLICY IF EXISTS "Solo admins pueden actualizar descuentos" ON descuentos;
DROP POLICY IF EXISTS "Usuarios ven descuentos activos" ON descuentos;
DROP POLICY IF EXISTS "Admins ven todos los descuentos" ON descuentos;
DROP POLICY IF EXISTS "Solo admins pueden crear descuentos" ON descuentos;
DROP POLICY IF EXISTS "Solo admins pueden eliminar descuentos" ON descuentos;

-- PASO 2: Crear política segura para UPDATE
-- Solo los admins pueden actualizar descuentos directamente
CREATE POLICY "Solo admins pueden actualizar descuentos" ON descuentos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id::text = auth.uid()::text 
            AND usuarios.rol = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id::text = auth.uid()::text 
            AND usuarios.rol = 'admin'
        )
    );

-- PASO 3: Crear política READ para usuarios normales (pueden ver descuentos activos)
-- Esto permite a usuarios ver solo descuentos vigentes y activos
CREATE POLICY "Usuarios ven descuentos activos" ON descuentos
    FOR SELECT USING (
        activo = true 
        AND (fecha_fin IS NULL OR fecha_fin > CURRENT_TIMESTAMP)
    );

-- PASO 4: Crear política READ para admins (ven todo)
CREATE POLICY "Admins ven todos los descuentos" ON descuentos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id::text = auth.uid()::text 
            AND usuarios.rol = 'admin'
        )
    );

-- PASO 5: Crear política INSERT para admins solo
CREATE POLICY "Solo admins pueden crear descuentos" ON descuentos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id::text = auth.uid()::text 
            AND usuarios.rol = 'admin'
        )
    );

-- PASO 6: Crear política DELETE para admins solo
CREATE POLICY "Solo admins pueden eliminar descuentos" ON descuentos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id::text = auth.uid()::text 
            AND usuarios.rol = 'admin'
        )
    );

-- ============================================================================
-- PARTE 2: REPARAR TABLA DEVOLUCIONES
-- ============================================================================

-- PASO 6: LIMPIAR TODAS LAS POLÍTICAS ANTIGUAS
DROP POLICY IF EXISTS "devoluciones_allow_all" ON devoluciones;

-- PASO 6b: LIMPIAR LAS NUEVAS POLÍTICAS SI EXISTEN (para re-ejecución segura)
DROP POLICY IF EXISTS "Usuarios ven sus propias devoluciones" ON devoluciones;
DROP POLICY IF EXISTS "Devoluciones no se crean desde cliente" ON devoluciones;
DROP POLICY IF EXISTS "Admins pueden procesar devoluciones" ON devoluciones;
DROP POLICY IF EXISTS "Solo admins pueden eliminar devoluciones" ON devoluciones;

-- PASO 7: Crear política SELECT - Usuarios ven sus propias devoluciones
CREATE POLICY "Usuarios ven sus propias devoluciones" ON devoluciones
    FOR SELECT USING (
        -- El usuario es el que hizo la devolución (por email)
        (SELECT auth.email()) = usuario_email
        OR
        -- O es un admin
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id::text = auth.uid()::text 
            AND usuarios.rol = 'admin'
        )
    );

-- PASO 8: Crear política INSERT - Solo API/servidor puede crear devoluciones
-- Los usuarios NO pueden insertar directamente
CREATE POLICY "Devoluciones no se crean desde cliente" ON devoluciones
    FOR INSERT WITH CHECK (false);

-- PASO 9: Crear política UPDATE - Admins pueden cambiar estado
CREATE POLICY "Admins pueden procesar devoluciones" ON devoluciones
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id::text = auth.uid()::text 
            AND usuarios.rol = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id::text = auth.uid()::text 
            AND usuarios.rol = 'admin'
        )
    );

-- PASO 10: Crear política DELETE - Solo admins pueden eliminar
CREATE POLICY "Solo admins pueden eliminar devoluciones" ON devoluciones
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id::text = auth.uid()::text 
            AND usuarios.rol = 'admin'
        )
    );

-- ============================================================================
-- PARTE 3: VERIFICACIÓN
-- ============================================================================

-- Verificar que las políticas fueron creadas correctamente
-- Ejecuta esto después de aplicar el script para confirmar:
/*
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive
FROM pg_policies 
WHERE tablename IN ('descuentos', 'devoluciones')
ORDER BY tablename, policyname;
*/

-- ============================================================================
-- INFORMACIÓN IMPORTANTE
-- ============================================================================
-- 
-- 1. DESCUENTOS:
--    - Usuarios: Pueden VER descuentos activos y vigentes
--    - Admins: Pueden VER, CREAR, EDITAR y ELIMINAR descuentos
--    - El fraud de incrementar usos está prevenido
--
-- 2. DEVOLUCIONES:
--    - Usuarios: Pueden VER solo sus propias devoluciones
--    - Admins: Pueden VER todas, EDITAR estado, ELIMINAR
--    - Los usuarios NO pueden crear desde cliente (solo servidor)
--
-- 3. PARA ACTUALIZAR USOS DE DESCUENTOS:
--    - El backend debe usar SUPABASE_SERVICE_ROLE_KEY (no anon)
--    - O crear una función plpgsql SECURITY DEFINER
--
-- ============================================================================

-- ============================================================================
-- OPCIONAL: Crear función SECURITY DEFINER para incrementar usos
-- ============================================================================
-- Descomenta esto si quieres un endpoint seguro para incrementar usos

/*
CREATE OR REPLACE FUNCTION incrementar_uso_descuento(p_codigo TEXT)
RETURNS JSON AS $$
DECLARE
    v_descuento_id UUID;
    v_usos_actuales INT;
    v_usos_maximos INT;
BEGIN
    -- Obtener el descuento y validar
    SELECT id, usos_actuales, usos_maximos 
    INTO v_descuento_id, v_usos_actuales, v_usos_maximos
    FROM descuentos
    WHERE codigo = p_codigo AND activo = true;
    
    IF v_descuento_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Descuento no encontrado');
    END IF;
    
    -- Si hay límite de usos, verificar
    IF v_usos_maximos > 0 AND v_usos_actuales >= v_usos_maximos THEN
        RETURN json_build_object('success', false, 'error', 'Descuento agotado');
    END IF;
    
    -- Incrementar uso
    UPDATE descuentos 
    SET usos_actuales = usos_actuales + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_descuento_id;
    
    RETURN json_build_object(
        'success', true, 
        'id', v_descuento_id,
        'nuevoUso', v_usos_actuales + 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Dar permisos para llamar la función
GRANT EXECUTE ON FUNCTION incrementar_uso_descuento(TEXT) TO anon, authenticated;
*/

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
