ALTER TABLE public.cliente_engajamento_produto
  ADD COLUMN IF NOT EXISTS leadtime_purchase_first timestamp with time zone,
  ADD COLUMN IF NOT EXISTS leadtime_purchase_first10 timestamp with time zone,
  ADD COLUMN IF NOT EXISTS leadtime_purchase_first50 timestamp with time zone,
  ADD COLUMN IF NOT EXISTS leadtime_purchase_first100 timestamp with time zone,
  ADD COLUMN IF NOT EXISTS leadtime_purchase_first200 timestamp with time zone;