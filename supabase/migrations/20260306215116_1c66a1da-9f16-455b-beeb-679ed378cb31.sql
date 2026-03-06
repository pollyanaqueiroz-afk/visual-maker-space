
ALTER TABLE public.meetings 
  ADD COLUMN IF NOT EXISTS funil_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS funil_notas text DEFAULT NULL;
