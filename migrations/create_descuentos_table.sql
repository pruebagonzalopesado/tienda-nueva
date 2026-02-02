-- Crear tabla de códigos de descuento
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

-- Crear índice para búsquedas por código
CREATE INDEX idx_descuentos_codigo ON descuentos(codigo);

-- Crear índice para búsquedas por estado activo
CREATE INDEX idx_descuentos_activo ON descuentos(activo);

-- Habilitar RLS (Row Level Security)
ALTER TABLE descuentos ENABLE ROW LEVEL SECURITY;

-- Política para que los admins puedan hacer cualquier cosa
CREATE POLICY "Los admins pueden gestionar descuentos" ON descuentos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.id::text = auth.uid()::text 
            AND usuarios.rol = 'admin'
        )
    );

-- Política para que los usuarios puedan ver los descuentos activos
CREATE POLICY "Los usuarios pueden ver descuentos activos" ON descuentos
    FOR SELECT USING (activo = true AND (fecha_fin IS NULL OR fecha_fin > CURRENT_TIMESTAMP));

-- Política para que cualquiera (incluyendo usuarios no autenticados) pueda ACTUALIZAR usos_actuales
CREATE POLICY "Cualquiera puede actualizar usos" ON descuentos
    FOR UPDATE USING (true) WITH CHECK (true);
