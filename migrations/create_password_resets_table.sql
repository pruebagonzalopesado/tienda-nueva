-- Crear tabla para gestionar reset de contraseñas con Brevo
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  usado BOOLEAN DEFAULT FALSE,
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_expiracion TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
  fecha_uso TIMESTAMP WITH TIME ZONE
);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_usado ON password_resets(usado);

-- Activar RLS
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Política: cualquiera puede leer (para validar tokens)
CREATE POLICY "Permitir lectura de password_resets"
  ON password_resets
  FOR SELECT
  USING (true);

-- Política: permitir inserción (para crear nuevos resets)
CREATE POLICY "Permitir inserción en password_resets"
  ON password_resets
  FOR INSERT
  WITH CHECK (true);

-- Política: permitir actualización de usado (para marcar como utilizado)
CREATE POLICY "Permitir actualizar password_resets"
  ON password_resets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
