
-- Drop existing table (cascades RLS policies)
DROP TABLE IF EXISTS public.cliente_financeiro CASCADE;

-- Recreate with all required columns
CREATE TABLE public.cliente_financeiro (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_curseduca text NOT NULL,
  nome text,
  email text,
  codigo_assinatura_meio_pagamento text,
  codigo_cliente_meio_pagamento text,
  plano text,
  meio_de_pagamento text,
  meio_pagamento text,
  valor_contratado numeric DEFAULT 0,
  numero_parcelas_pagas integer DEFAULT 0,
  numero_parcelas_inadimplentes integer DEFAULT 0,
  numero_parcelas_contrato integer DEFAULT 0,
  recorrencia_pagamento text,
  is_plano boolean DEFAULT false,
  tipo_plano text,
  is_upsell boolean DEFAULT false,
  tipo_upsell text,
  status text DEFAULT 'ativo',
  vigencia_assinatura text,
  data_criacao timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cliente_financeiro ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
CREATE POLICY "Authenticated users can view cliente_financeiro" ON public.cliente_financeiro FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert cliente_financeiro" ON public.cliente_financeiro FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update cliente_financeiro" ON public.cliente_financeiro FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete cliente_financeiro" ON public.cliente_financeiro FOR DELETE TO authenticated USING (true);
