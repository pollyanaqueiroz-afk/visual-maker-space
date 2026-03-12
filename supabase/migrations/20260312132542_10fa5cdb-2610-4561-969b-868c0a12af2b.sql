ALTER TABLE public.cliente_financeiro 
  ADD COLUMN IF NOT EXISTS nome_plano_master text,
  ADD COLUMN IF NOT EXISTS tipo_plano_master text;