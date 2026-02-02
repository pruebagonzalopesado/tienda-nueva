-- Crear tabla de devoluciones
CREATE TABLE IF NOT EXISTS devoluciones (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    usuario_email VARCHAR(255) NOT NULL,
    usuario_nombre VARCHAR(255),
    motivo_solicitud TEXT NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'procesado' CHECK (estado IN ('procesado', 'confirmada', 'rechazada')),
    motivo_rechazo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_devolucion_pedido UNIQUE(pedido_id)
);

-- Crear índices
CREATE INDEX idx_devoluciones_pedido_id ON devoluciones(pedido_id);
CREATE INDEX idx_devoluciones_estado ON devoluciones(estado);
CREATE INDEX idx_devoluciones_email ON devoluciones(usuario_email);
CREATE INDEX idx_devoluciones_created_at ON devoluciones(created_at);

-- Agregar RLS (Row Level Security)
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
-- Los usuarios pueden ver sus propias devoluciones
CREATE POLICY "Usuarios pueden ver sus propias devoluciones" 
    ON devoluciones FOR SELECT 
    USING (auth.jwt() ->> 'email' = usuario_email OR auth.jwt() ->> 'role' = 'admin');

-- Los usuarios pueden insertar sus propias devoluciones
CREATE POLICY "Usuarios pueden crear devoluciones" 
    ON devoluciones FOR INSERT 
    WITH CHECK (auth.jwt() ->> 'email' = usuario_email);

-- Solo admin puede actualizar estado de devoluciones
CREATE POLICY "Admin puede actualizar devoluciones" 
    ON devoluciones FOR UPDATE 
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');
