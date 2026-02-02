-- Agregar columna enlace_url a la tabla gallery_slides
ALTER TABLE public.gallery_slides
ADD COLUMN IF NOT EXISTS enlace_url character varying DEFAULT '/productos';

-- Actualizar slides existentes con URLs basadas en sus títulos
UPDATE public.gallery_slides
SET enlace_url = CASE 
    WHEN titulo ILIKE '%Anillos%' THEN '/productos?categoria=Anillos'
    WHEN titulo ILIKE '%Collares%' THEN '/productos?categoria=Collares'
    WHEN titulo ILIKE '%Pulseras%' THEN '/productos?categoria=Pulseras'
    WHEN titulo ILIKE '%Relojes%' THEN '/productos?categoria=Relojes'
    WHEN titulo ILIKE '%Ofertas%' OR titulo ILIKE '%Descuentos%' OR titulo ILIKE '%Promo%' THEN '/ofertas'
    WHEN titulo ILIKE '%Nuevos%' OR titulo ILIKE '%Novedades%' THEN '/productos?orden=reciente'
    ELSE '/productos'
END
WHERE enlace_url = '/productos';
