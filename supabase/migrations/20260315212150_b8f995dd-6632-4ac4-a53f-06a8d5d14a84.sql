ALTER TABLE public.cliente_engajamento_produto
  DROP COLUMN IF EXISTS plano,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS cs_atual,
  DROP COLUMN IF EXISTS nome,
  DROP COLUMN IF EXISTS data_criacao,
  DROP COLUMN IF EXISTS status_curseduca,
  DROP COLUMN IF EXISTS status_financeiro;