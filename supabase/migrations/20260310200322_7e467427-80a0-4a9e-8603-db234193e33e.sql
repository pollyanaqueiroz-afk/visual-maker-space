ALTER TABLE public.carteirizacao_ferias 
  ADD COLUMN IF NOT EXISTS movido_ida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS movido_volta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS movido_ida_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS movido_volta_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS clientes_movidos integer DEFAULT 0;