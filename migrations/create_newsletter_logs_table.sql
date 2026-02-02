-- Crear tabla para logs de envío de newsletter
CREATE TABLE IF NOT EXISTS newsletter_logs (
    id BIGSERIAL PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    total_recipients INTEGER NOT NULL,
    emails_sent INTEGER NOT NULL,
    sent_by VARCHAR(255),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice para búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_newsletter_logs_sent_at ON newsletter_logs(sent_at DESC);

-- Habilitar RLS
ALTER TABLE newsletter_logs ENABLE ROW LEVEL SECURITY;

-- Policy para que público pueda ver logs (para lectura desde admin panel)
CREATE POLICY IF NOT EXISTS "Permitir lectura pública de logs" ON newsletter_logs
    FOR SELECT
    TO public
    USING (true);

-- Policy para que cualquiera pueda insertar logs (el service role usará esto)
CREATE POLICY IF NOT EXISTS "Permitir inserción de logs" ON newsletter_logs
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Policy para actualizar logs
CREATE POLICY IF NOT EXISTS "Permitir actualización de logs" ON newsletter_logs
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

