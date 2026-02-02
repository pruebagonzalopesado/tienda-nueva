-- Agregar columna marca a la tabla products
ALTER TABLE public.products
ADD COLUMN marca VARCHAR(255) DEFAULT NULL;

-- Crear índice para búsquedas rápidas por marca
CREATE INDEX idx_products_marca ON public.products(marca);
