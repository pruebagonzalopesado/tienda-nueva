-- Agregar campos de Stripe a la tabla pedidos
ALTER TABLE pedidos
ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

-- Crear índices para las búsquedas
CREATE INDEX IF NOT EXISTS idx_pedidos_stripe_session_id ON pedidos(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_stripe_payment_intent_id ON pedidos(stripe_payment_intent_id);
