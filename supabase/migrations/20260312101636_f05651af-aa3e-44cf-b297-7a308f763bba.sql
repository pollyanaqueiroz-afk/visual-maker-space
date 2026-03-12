
-- Reversão de Cancelamento tracking
CREATE TABLE public.reversao_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  client_url TEXT,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'nenhum_contato',
  status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(meeting_id)
);

ALTER TABLE public.reversao_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reversao_tracking"
  ON public.reversao_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert reversao_tracking"
  ON public.reversao_tracking FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update reversao_tracking"
  ON public.reversao_tracking FOR UPDATE TO authenticated USING (true);

-- Clientes Inativos tracking
CREATE TABLE public.clientes_inativos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_curseduca TEXT NOT NULL UNIQUE,
  client_name TEXT,
  client_url TEXT,
  plano TEXT,
  motivo_cancelamento TEXT,
  data_cancelamento DATE,
  ultimo_cs TEXT,
  receita_anterior NUMERIC,
  status_financeiro TEXT,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes_inativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clientes_inativos"
  ON public.clientes_inativos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clientes_inativos"
  ON public.clientes_inativos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clientes_inativos"
  ON public.clientes_inativos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clientes_inativos"
  ON public.clientes_inativos FOR DELETE TO authenticated USING (true);
