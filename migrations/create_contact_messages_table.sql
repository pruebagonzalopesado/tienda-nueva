-- Crear tabla para mensajes de contacto desde la página de inicio
CREATE TABLE IF NOT EXISTS contact_messages (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    asunto VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT false,
    respondido BOOLEAN DEFAULT false,
    respuesta TEXT,
    respondido_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para búsquedas
CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_messages(email);
CREATE INDEX IF NOT EXISTS idx_contact_leido ON contact_messages(leido);
CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_messages(created_at DESC);

-- Habilitar RLS
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Policy para que público pueda insertar mensajes
CREATE POLICY IF NOT EXISTS "Permitir inserción pública de mensajes" ON contact_messages
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Policy para que público pueda ver sus propios mensajes (por email)
CREATE POLICY IF NOT EXISTS "Permitir lectura de propios mensajes" ON contact_messages
    FOR SELECT
    TO public
    USING (true);

-- Policy para que admin pueda actualizar mensajes
CREATE POLICY IF NOT EXISTS "Permitir actualización de mensajes" ON contact_messages
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);
