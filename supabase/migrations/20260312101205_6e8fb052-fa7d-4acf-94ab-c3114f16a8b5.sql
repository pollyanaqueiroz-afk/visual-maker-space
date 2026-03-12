
CREATE TABLE public.upsell_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_curseduca TEXT NOT NULL,
  client_name TEXT,
  client_url TEXT,
  tipo TEXT NOT NULL DEFAULT 'banda',
  status TEXT NOT NULL DEFAULT 'nenhum_contato',
  valor_pagamento NUMERIC,
  data_pagamento DATE,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(id_curseduca, tipo)
);

ALTER TABLE public.upsell_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view upsell_tracking"
  ON public.upsell_tracking FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert upsell_tracking"
  ON public.upsell_tracking FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update upsell_tracking"
  ON public.upsell_tracking FOR UPDATE TO authenticated
  USING (true);
