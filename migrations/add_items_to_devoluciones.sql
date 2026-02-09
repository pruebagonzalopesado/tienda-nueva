-- Agregar columna para items devueltos en devoluciones parciales
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS items_devueltos JSONB DEFAULT NULL;
ALTER TABLE devoluciones ADD COLUMN IF NOT EXISTS monto_reembolso DECIMAL(10, 2) DEFAULT NULL;

-- Eliminar constraint UNIQUE para permitir múltiples devoluciones del mismo pedido (parciales)
ALTER TABLE devoluciones DROP CONSTRAINT IF NOT EXISTS unique_devolucion_pedido;

-- Crear nuevo índice para buscar devoluciones activas
CREATE INDEX IF NOT EXISTS idx_devoluciones_pedido_estado ON devoluciones(pedido_id, estado);
