-- Script para crear registros en usuarios para usuarios de Auth que no estén en la tabla

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
