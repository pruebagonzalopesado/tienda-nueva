-- Agregar política para permitir que public (usuarios no autenticados) inserte descuentos para newsletter
CREATE POLICY "Public puede insertar descuentos para newsletter" ON descuentos
    FOR INSERT
    TO public
    WITH CHECK (true);
