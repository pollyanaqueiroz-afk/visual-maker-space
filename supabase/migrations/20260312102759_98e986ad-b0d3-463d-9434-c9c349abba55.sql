
-- Rename 'cliente' to 'nome'
ALTER TABLE public.clients RENAME COLUMN cliente TO nome;

-- Remove columns no longer needed
ALTER TABLE public.clients DROP COLUMN IF EXISTS fatura;
ALTER TABLE public.clients DROP COLUMN IF EXISTS data_da_carga;
ALTER TABLE public.clients DROP COLUMN IF EXISTS created_at;

-- Add new columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status_financeiro TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status_curseduca TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS indice_fidelidade INTEGER;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email_alternativo TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS telefone_alternativo TEXT;
