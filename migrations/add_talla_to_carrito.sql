-- Agregar columna talla a la tabla carrito para guardar la talla de anillos
ALTER TABLE carrito ADD COLUMN IF NOT EXISTS talla INTEGER DEFAULT NULL;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_carrito_user_product_talla ON carrito(user_id, product_id, talla);
