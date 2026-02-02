-- Trigger para crear automáticamente un registro en usuarios cuando se autentica
-- Este script crea una función y un trigger en Supabase

-- Crear la función que se ejecutará cuando se registre un nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre, apellido, telefono, direccion, ciudad, codigo_postal, rol, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nombre', new.email),
    COALESCE(new.raw_user_meta_data->>'apellido', ''),
    COALESCE(new.raw_user_meta_data->>'telefono', ''),
    COALESCE(new.raw_user_meta_data->>'direccion', ''),
    COALESCE(new.raw_user_meta_data->>'ciudad', ''),
    COALESCE(new.raw_user_meta_data->>'codigo_postal', ''),
    'usuario',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crear el trigger que llama a la función
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Crear registros para usuarios existentes que no tengan registro en usuarios
INSERT INTO public.usuarios (id, email, nombre, apellido, telefono, direccion, ciudad, codigo_postal, rol, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'nombre', u.email),
  COALESCE(u.raw_user_meta_data->>'apellido', ''),
  COALESCE(u.raw_user_meta_data->>'telefono', ''),
  COALESCE(u.raw_user_meta_data->>'direccion', ''),
  COALESCE(u.raw_user_meta_data->>'ciudad', ''),
  COALESCE(u.raw_user_meta_data->>'codigo_postal', ''),
  'usuario',
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.usuarios p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
