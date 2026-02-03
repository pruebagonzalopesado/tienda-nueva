/**
 * Script SQL para crear la tabla de reservas de stock
 * Ejecutar en la consola de Supabase
 */

-- Crear tabla de reservas de carrito
CREATE TABLE carrito_reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT, -- Para usuarios no autenticados
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    talla TEXT, -- Para anillos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 minutes', -- Las reservas expiran
    UNIQUE(product_id, user_id, talla) -- Una reserva por producto/usuario/talla
);

-- Índices para performance
CREATE INDEX idx_carrito_reservas_user ON carrito_reservas(user_id);
CREATE INDEX idx_carrito_reservas_session ON carrito_reservas(session_id);
CREATE INDEX idx_carrito_reservas_product ON carrito_reservas(product_id);
CREATE INDEX idx_carrito_reservas_expires ON carrito_reservas(expires_at);

-- Trigger para limpiar reservas expiradas
CREATE OR REPLACE FUNCTION limpiar_reservas_expiradas()
RETURNS void AS $$
BEGIN
  DELETE FROM carrito_reservas WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Función para obtener stock disponible real
CREATE OR REPLACE FUNCTION get_stock_disponible(product_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  stock_total INTEGER;
  stock_reservado INTEGER;
  stock_disponible INTEGER;
BEGIN
  -- Obtener stock total
  SELECT stock INTO stock_total FROM products WHERE id = product_id;
  
  -- Obtener stock reservado (excluyendo expirados)
  SELECT COALESCE(SUM(cantidad), 0) INTO stock_reservado 
  FROM carrito_reservas 
  WHERE carrito_reservas.product_id = product_id 
  AND expires_at > NOW();
  
  -- Calcular disponible
  stock_disponible := stock_total - stock_reservado;
  
  RETURN GREATEST(0, stock_disponible);
END;
$$ LANGUAGE plpgsql;

-- RLS para la tabla de reservas
ALTER TABLE carrito_reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Las reservas pueden ser leídas por el owner o por session_id"
ON carrito_reservas FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (session_id IS NOT NULL)
);

CREATE POLICY "Los usuarios pueden insertar sus propias reservas"
ON carrito_reservas FOR INSERT
WITH CHECK (
  (auth.uid() = user_id)
);

CREATE POLICY "Los usuarios pueden actualizar sus propias reservas"
ON carrito_reservas FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias reservas"
ON carrito_reservas FOR DELETE
USING (auth.uid() = user_id);
