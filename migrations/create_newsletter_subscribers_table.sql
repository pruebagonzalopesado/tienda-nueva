-- Crear tabla para suscriptores del newsletter
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'activo', -- 'activo', 'inactivo'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice para búsquedas rápidas de email
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);

-- Crear índice para estado
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status);

-- Habilitar RLS
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Policy para que CUALQUIERA (público y autenticado) pueda insertar
CREATE POLICY "Permitir inserción pública" ON newsletter_subscribers
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Policy para que el público pueda seleccionar (solo su propio email)
CREATE POLICY "Público puede verificar suscripción" ON newsletter_subscribers
    FOR SELECT
    TO public
    USING (true);

-- Policy para que solo admin pueda leer todos
CREATE POLICY "Admin puede leer suscriptores" ON newsletter_subscribers
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data ->> 'user_role' = 'admin'
        )
    );

-- Policy para que solo admin pueda actualizar
CREATE POLICY "Admin puede actualizar suscriptores" ON newsletter_subscribers
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data ->> 'user_role' = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data ->> 'user_role' = 'admin'
        )
    );

-- Policy para que solo admin pueda eliminar
CREATE POLICY "Admin puede eliminar suscriptores" ON newsletter_subscribers
    FOR DELETE
    TO public
    USING (true);
