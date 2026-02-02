-- Agregar columna enlace_url a gallery_slides
ALTER TABLE public.gallery_slides
ADD COLUMN enlace_url character varying DEFAULT '/productos';

-- Actualizar los slides existentes con URLs por defecto según su título
UPDATE public.gallery_slides
SET enlace_url = CASE 
  WHEN titulo ILIKE '%Anillos%' THEN '/productos?categoria=Anillos'
  WHEN titulo ILIKE '%Collares%' THEN '/productos?categoria=Collares'
  WHEN titulo ILIKE '%Pendientes%' THEN '/productos?categoria=Pendientes'
  WHEN titulo ILIKE '%Pulseras%' THEN '/productos?categoria=Pulseras'
  WHEN titulo ILIKE '%Relojes%' THEN '/productos?categoria=Relojes'
  WHEN titulo ILIKE '%Medallas%' THEN '/productos?categoria=Medallas'
  ELSE '/productos'
END;
