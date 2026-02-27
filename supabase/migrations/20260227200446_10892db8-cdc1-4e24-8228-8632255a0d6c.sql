
-- Add plan, monthly_value, and client_status columns to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS plan text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS monthly_value numeric;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_status text DEFAULT 'ativo';
