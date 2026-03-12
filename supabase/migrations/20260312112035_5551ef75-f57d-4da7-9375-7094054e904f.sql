
CREATE TABLE public.cliente_financeiro (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_curseduca text NOT NULL,
  codigo_assinatura_meio_pagamento text,
  codigo_cliente_meio_pagamento text,
  meio_de_pagamento text,
  valor_contratado numeric DEFAULT 0,
  numero_parcelas_pagas integer DEFAULT 0,
  numero_parcelas_inadimplentes integer DEFAULT 0,
  numero_parcelas_contrato integer DEFAULT 0,
  recorrencia_pagamento text,
  status text DEFAULT 'ativo',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cliente_financeiro ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view cliente_financeiro"
  ON public.cliente_financeiro FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cliente_financeiro"
  ON public.cliente_financeiro FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cliente_financeiro"
  ON public.cliente_financeiro FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete cliente_financeiro"
  ON public.cliente_financeiro FOR DELETE TO authenticated
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_cliente_financeiro_updated_at
  BEFORE UPDATE ON public.cliente_financeiro
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
