
ALTER TABLE public.carteirizacao_cs 
  ADD COLUMN plano_id UUID REFERENCES public.carteirizacao_planos(id) ON DELETE CASCADE;

-- Remove the old planos text array column
ALTER TABLE public.carteirizacao_cs DROP COLUMN planos;

-- Drop old unique constraint if exists and add new one
ALTER TABLE public.carteirizacao_cs DROP CONSTRAINT IF EXISTS carteirizacao_cs_etapa_id_user_email_key;
ALTER TABLE public.carteirizacao_cs ADD CONSTRAINT carteirizacao_cs_plano_etapa_email_unique UNIQUE (plano_id, etapa_id, user_email);
