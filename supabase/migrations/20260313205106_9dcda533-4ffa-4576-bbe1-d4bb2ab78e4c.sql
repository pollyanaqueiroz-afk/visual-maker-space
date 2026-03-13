
CREATE TABLE public.inconsistencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fonte TEXT NOT NULL DEFAULT 'vindi',
  tipo TEXT NOT NULL,
  id_curseduca TEXT,
  nome TEXT,
  email TEXT,
  codigo_assinatura_meio_pagamento TEXT,
  codigo_cliente_meio_pagamento TEXT,
  plano TEXT,
  meio_de_pagamento TEXT,
  valor_contratado NUMERIC,
  numero_parcelas_pagas INTEGER,
  numero_parcelas_inadimplentes INTEGER,
  numero_parcelas_contrato INTEGER,
  recorrencia_pagamento TEXT,
  is_plano BOOLEAN,
  is_upsell BOOLEAN,
  tipo_produto_master TEXT,
  nome_plano_master TEXT,
  status TEXT,
  vigencia_assinatura TEXT,
  data_criacao TEXT,
  resolvido BOOLEAN NOT NULL DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  resolvido_por TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inconsistencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inconsistencias"
  ON public.inconsistencias FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update inconsistencias"
  ON public.inconsistencias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can insert inconsistencias"
  ON public.inconsistencias FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_inconsistencias_fonte ON public.inconsistencias(fonte);
CREATE INDEX idx_inconsistencias_tipo ON public.inconsistencias(tipo);
CREATE INDEX idx_inconsistencias_resolvido ON public.inconsistencias(resolvido);
