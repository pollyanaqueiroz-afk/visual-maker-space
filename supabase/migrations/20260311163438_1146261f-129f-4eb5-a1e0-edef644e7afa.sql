
-- Table for app adjustment requests (icon/description changes)
CREATE TABLE public.app_ajustes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_url TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('icone', 'descricao')),
  nova_descricao TEXT,
  icone_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view app_ajustes"
  ON public.app_ajustes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert app_ajustes"
  ON public.app_ajustes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update app_ajustes"
  ON public.app_ajustes FOR UPDATE TO authenticated
  USING (true);

-- Update F3 phase names to include platform label
UPDATE public.app_fases SET nome = 'Criação e Submissão (Apple)' WHERE numero = 3 AND plataforma = 'apple';
UPDATE public.app_fases SET nome = 'Criação e Submissão (Google)' WHERE numero = 3 AND plataforma = 'google';

-- Update criar_fases_cliente to use new F3 names and set default analyst
CREATE OR REPLACE FUNCTION public.criar_fases_cliente(p_cliente_id uuid, p_plataforma text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Fase 0 sempre única (compartilhada)
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES (p_cliente_id, 0, 'Pré-Requisitos', 'compartilhada', 'em_andamento', 48, 2);

  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada) VALUES
      (p_cliente_id, 1, 'Primeiros Passos', 'google', 'bloqueada', 48, 3),
      (p_cliente_id, 2, 'Validação pela Loja', 'google', 'bloqueada', 168, 7),
      (p_cliente_id, 3, 'Criação e Submissão (Google)', 'google', 'bloqueada', 48, 5),
      (p_cliente_id, 4, 'Aprovação das Lojas', 'google', 'bloqueada', 672, 28),
      (p_cliente_id, 5, 'Teste do App', 'google', 'bloqueada', 48, 2),
      (p_cliente_id, 6, 'Publicado 🎉', 'google', 'bloqueada', NULL, 1);
  END IF;

  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada) VALUES
      (p_cliente_id, 1, 'Primeiros Passos', 'apple', 'bloqueada', 48, 3),
      (p_cliente_id, 2, 'Validação pela Loja', 'apple', 'bloqueada', 168, 7),
      (p_cliente_id, 3, 'Criação e Submissão (Apple)', 'apple', 'bloqueada', 48, 5),
      (p_cliente_id, 4, 'Aprovação das Lojas', 'apple', 'bloqueada', 672, 28),
      (p_cliente_id, 5, 'Teste do App', 'apple', 'bloqueada', 48, 2),
      (p_cliente_id, 6, 'Publicado 🎉', 'apple', 'bloqueada', NULL, 1);
  END IF;

  -- Checklist Fase 0 (compartilhada)
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
    (p_cliente_id, 0, 'Solicitei o número DUNS da minha empresa', 'Acesse https://www.dnb.com/de-de/upik-en.html', 'cliente', 'link', 1, 'compartilhada'),
    (p_cliente_id, 0, 'Confirmei que meu CNPJ é ME ou LTDA', 'CNPJs MEI não são aceitos pela Apple.', 'cliente', 'check', 2, 'compartilhada'),
    (p_cliente_id, 0, 'Tenho um e-mail corporativo', 'email@suaempresa.com.br', 'cliente', 'check', 3, 'compartilhada'),
    (p_cliente_id, 0, 'Meu site está publicado com domínio próprio', 'Domínio próprio.', 'cliente', 'check', 4, 'compartilhada');

  -- Checklist Fase 1 por plataforma
  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 1, 'Criei a conta no Google Play Console', 'Acesse https://play.google.com/console/signup. Taxa: US$ 25.', 'cliente', 'link', 1, 'google'),
      (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Google)', 'No Google Play Console → Usuários e permissões → Administrador.', 'cliente', 'check', 2, 'google'),
      (p_cliente_id, 1, 'Documentação verificada pelo analista (Google)', 'Analista confirma configuração correta.', 'analista', 'check', 3, 'google');
  END IF;
  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 1, 'Criei a conta no Apple Developer Program', 'Acesse https://developer.apple.com/account. Taxa: US$ 99/ano.', 'cliente', 'link', 1, 'apple'),
      (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Apple)', 'No App Store Connect → Usuários e acessos.', 'cliente', 'check', 2, 'apple'),
      (p_cliente_id, 1, 'Documentação verificada pelo analista (Apple)', 'Analista confirma configuração correta.', 'analista', 'check', 3, 'apple');
  END IF;

  -- Checklist Fase 3 por plataforma with default analyst
  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma, responsavel) VALUES
      (p_cliente_id, 3, 'Formulário do aplicativo (Google)', 'Informações para Google Play.', 'cliente', 'form', 1, 'google', NULL),
      (p_cliente_id, 3, 'Desenvolvimento e Submissão Google Play', 'Equipe submete na Google Play.', 'analista', 'check', 2, 'google', 'Jamerson');
  END IF;
  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma, responsavel) VALUES
      (p_cliente_id, 3, 'Formulário do aplicativo (Apple)', 'Informações para App Store.', 'cliente', 'form', 1, 'apple', NULL),
      (p_cliente_id, 3, 'Desenvolvimento e Submissão App Store', 'Equipe submete na App Store.', 'analista', 'check', 2, 'apple', 'Luiz Gustavo');
  END IF;

  -- Checklist Fase 5 por plataforma
  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 5, 'Fiz login no app de teste (Google)', 'Testei o app Android.', 'cliente', 'check', 1, 'google'),
      (p_cliente_id, 5, 'Naveguei pelo conteúdo principal (Google)', 'Verifiquei cursos no Android.', 'cliente', 'check', 2, 'google'),
      (p_cliente_id, 5, 'Aprovei o app para publicação (Google)', 'App Android está pronto.', 'cliente', 'approval_final', 3, 'google');
  END IF;
  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 5, 'Fiz login no app de teste (Apple)', 'Testei o app iOS.', 'cliente', 'check', 1, 'apple'),
      (p_cliente_id, 5, 'Naveguei pelo conteúdo principal (Apple)', 'Verifiquei cursos no iOS.', 'cliente', 'check', 2, 'apple'),
      (p_cliente_id, 5, 'Aprovei o app para publicação (Apple)', 'App iOS está pronto.', 'cliente', 'approval_final', 3, 'apple');
  END IF;

  -- Checklist Fase 6 por plataforma (publicacao_url)
  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 6, 'Confirmar publicação e informar URL (Google Play)', 'Preencha a URL do app na Google Play Store para notificar o cliente. Prazo: 1 dia útil.', 'analista', 'publicacao_url', 1, 'google');
  END IF;
  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 6, 'Confirmar publicação e informar URL (App Store)', 'Preencha a URL do app na App Store para notificar o cliente. Prazo: 1 dia útil.', 'analista', 'publicacao_url', 1, 'apple');
  END IF;

  INSERT INTO app_prerequisitos (cliente_id) VALUES (p_cliente_id);
  INSERT INTO app_formulario (cliente_id) VALUES (p_cliente_id);
END;
$function$;

-- Set default analysts for existing F3 analyst tasks
UPDATE public.app_checklist_items 
SET responsavel = 'Jamerson' 
WHERE fase_numero = 3 AND ator = 'analista' AND plataforma = 'google' AND responsavel IS NULL;

UPDATE public.app_checklist_items 
SET responsavel = 'Luiz Gustavo' 
WHERE fase_numero = 3 AND ator = 'analista' AND plataforma = 'apple' AND responsavel IS NULL;
