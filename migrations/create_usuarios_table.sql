-- Crear tabla de usuarios
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    contrasena VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    direccion VARCHAR(255),
    ciudad VARCHAR(100),
    codigo_postal VARCHAR(20),
    pais VARCHAR(100),
    rol VARCHAR(20) DEFAULT 'user' CHECK (rol IN ('user', 'admin')),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice para búsquedas por email
CREATE INDEX idx_usuarios_email ON usuarios(email);

-- Crear índice para búsquedas por estado activo
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- Habilitar RLS (Row Level Security)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios vean su propio perfil
CREATE POLICY "Los usuarios pueden ver su propio perfil" ON usuarios
    FOR SELECT USING (auth.uid()::text = id::text);

-- Política para que los usuarios actualicen su propio perfil
CREATE POLICY "Los usuarios pueden actualizar su propio perfil" ON usuarios
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Política para que cualquiera pueda registrarse (insertar)
CREATE POLICY "Cualquiera puede registrarse" ON usuarios
    FOR INSERT WITH CHECK (true);
