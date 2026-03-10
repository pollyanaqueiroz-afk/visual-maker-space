
-- Planos configuráveis (Ex: Básico, Pro, Enterprise)
CREATE TABLE public.carteirizacao_planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Etapas/tipos de carteira (Ex: Onboarding, Implantação)
CREATE TABLE public.carteirizacao_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CS atribuídos por etapa, com peso e planos que atendem
CREATE TABLE public.carteirizacao_cs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id UUID NOT NULL REFERENCES public.carteirizacao_etapas(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  peso INTEGER NOT NULL DEFAULT 1,
  planos TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(etapa_id, user_email)
);

-- Férias de CS com substituto
CREATE TABLE public.carteirizacao_ferias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cs_email TEXT NOT NULL,
  substituto_email TEXT NOT NULL,
  substituto_nome TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  motivo TEXT DEFAULT 'ferias',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.carteirizacao_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carteirizacao_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carteirizacao_cs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carteirizacao_ferias ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins manage planos" ON public.carteirizacao_planos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read planos" ON public.carteirizacao_planos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage etapas" ON public.carteirizacao_etapas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read etapas" ON public.carteirizacao_etapas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage cs" ON public.carteirizacao_cs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read cs" ON public.carteirizacao_cs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage ferias" ON public.carteirizacao_ferias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read ferias" ON public.carteirizacao_ferias FOR SELECT TO authenticated USING (true);
