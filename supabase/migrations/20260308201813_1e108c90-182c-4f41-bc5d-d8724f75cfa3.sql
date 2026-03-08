ALTER TABLE app_clientes ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ;
ALTER TABLE app_clientes ADD COLUMN IF NOT EXISTS cancelado_por TEXT;
ALTER TABLE app_clientes ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;