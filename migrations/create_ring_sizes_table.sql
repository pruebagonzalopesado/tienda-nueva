-- Crear tabla de tallas para anillos
CREATE TABLE IF NOT EXISTS ring_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size_number INTEGER NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insertar tallas estándar de anillos (6-22)
INSERT INTO ring_sizes (size_number, description) VALUES
  (6, 'Talla 6'),
  (7, 'Talla 7'),
  (8, 'Talla 8'),
  (9, 'Talla 9'),
  (10, 'Talla 10'),
  (11, 'Talla 11'),
  (12, 'Talla 12'),
  (13, 'Talla 13'),
  (14, 'Talla 14'),
  (15, 'Talla 15'),
  (16, 'Talla 16'),
  (17, 'Talla 17'),
  (18, 'Talla 18'),
  (19, 'Talla 19'),
  (20, 'Talla 20'),
  (21, 'Talla 21'),
  (22, 'Talla 22')
ON CONFLICT DO NOTHING;

-- Agregar columna has_sizes a la tabla products para indicar si usa sistema de tallas
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_sizes BOOLEAN DEFAULT FALSE;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_products_has_sizes ON products(has_sizes);
