-- Función para incrementar los usos de un descuento
CREATE OR REPLACE FUNCTION incrementar_uso_descuento(descuento_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE descuentos
    SET 
        usos_actuales = usos_actuales + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = descuento_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que cualquiera llame esta función
GRANT EXECUTE ON FUNCTION incrementar_uso_descuento(UUID) TO public, anon, authenticated;
