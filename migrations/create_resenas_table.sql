-- Crear tabla de reseñas de productos
CREATE TABLE IF NOT EXISTS resenas (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  pedido_id BIGINT NOT NULL,
  usuario_id UUID NOT NULL,
  usuario_nombre TEXT NOT NULL,
  usuario_email TEXT NOT NULL,
  calificacion INTEGER NOT NULL CHECK (calificacion >= 1 AND calificacion <= 5),
  titulo TEXT,
  comentario TEXT,
  imagen_usuario TEXT,
  compra_verificada BOOLEAN DEFAULT TRUE,
  estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Relaciones
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Índices para búsquedas frecuentes
  CONSTRAINT una_resena_por_producto_usuario UNIQUE(product_id, usuario_id, pedido_id)
);

-- Crear índices para optimizar búsquedas
CREATE INDEX idx_resenas_product_id ON resenas(product_id);
CREATE INDEX idx_resenas_usuario_id ON resenas(usuario_id);
CREATE INDEX idx_resenas_pedido_id ON resenas(pedido_id);
CREATE INDEX idx_resenas_estado ON resenas(estado);
CREATE INDEX idx_resenas_product_estado ON resenas(product_id, estado);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION actualizar_updated_at_resenas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_updated_at_resenas ON resenas;
CREATE TRIGGER trigger_actualizar_updated_at_resenas
  BEFORE UPDATE ON resenas
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at_resenas();

-- Habilitar RLS (Row Level Security)
ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;

-- Policy: Cualquiera puede ver reseñas aprobadas
CREATE POLICY "resenas_aprobadas_visible_todos"
  ON resenas
  FOR SELECT
  USING (estado = 'aprobado' OR estado = 'pendiente');

-- Policy: El usuario propietario puede actualizar su reseña
CREATE POLICY "resenas_actualizar_propietario"
  ON resenas
  FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Policy: El admin (via service role) puede ver y modificar todas
CREATE POLICY "resenas_admin_full_access"
  ON resenas
  USING (true)
  WITH CHECK (true);
