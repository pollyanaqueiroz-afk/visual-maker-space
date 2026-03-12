
CREATE TABLE public.cliente_churn (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_curseduca TEXT NOT NULL UNIQUE,
  client_name TEXT,
  client_url TEXT,
  plano TEXT,
  receita NUMERIC,
  cs_email TEXT,
  cs_nome TEXT,
  meeting_id UUID,
  loyalty_reason TEXT,
  status TEXT NOT NULL DEFAULT 'nenhum_contato',
  status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cliente_churn ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cliente_churn"
  ON public.cliente_churn FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert cliente_churn"
  ON public.cliente_churn FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update cliente_churn"
  ON public.cliente_churn FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete cliente_churn"
  ON public.cliente_churn FOR DELETE TO authenticated USING (true);
