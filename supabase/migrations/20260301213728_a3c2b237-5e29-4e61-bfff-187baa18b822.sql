
-- ============================================
-- TABELAS PRINCIPAIS — Esteira de Aplicativo
-- ============================================

CREATE TABLE app_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  empresa TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  whatsapp TEXT,
  plataforma TEXT NOT NULL DEFAULT 'ambos',
  responsavel_nome TEXT,
  responsavel_id UUID,
  fase_atual INTEGER DEFAULT 0,
  status TEXT DEFAULT 'no_prazo',
  porcentagem_geral INTEGER DEFAULT 0,
  prazo_estimado DATE,
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  ultima_acao_cliente TIMESTAMPTZ,
  portal_token UUID DEFAULT gen_random_uuid() UNIQUE,
  portal_primeiro_acesso TIMESTAMPTZ,
  hubspot_deal_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_prerequisitos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES app_clientes(id) ON DELETE CASCADE UNIQUE,
  duns_solicitado BOOLEAN DEFAULT FALSE,
  duns_numero TEXT,
  cnpj_tipo TEXT DEFAULT '',
  cnpj_bloqueado BOOLEAN DEFAULT FALSE,
  email_corporativo TEXT,
  site_url TEXT,
  site_publicado BOOLEAN DEFAULT FALSE,
  doc_cnpj_enviado BOOLEAN DEFAULT FALSE,
  doc_identidade_enviado BOOLEAN DEFAULT FALSE,
  telefone_verificado BOOLEAN DEFAULT FALSE,
  site_verificado_search_console BOOLEAN DEFAULT FALSE,
  apple_id_corporativo TEXT,
  inscricao_como_empresa BOOLEAN DEFAULT FALSE,
  taxa_apple_paga BOOLEAN DEFAULT FALSE,
  tudo_ok BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_fases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES app_clientes(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  nome TEXT NOT NULL,
  plataforma TEXT DEFAULT 'ambos',
  status TEXT DEFAULT 'bloqueada',
  data_inicio TIMESTAMPTZ,
  data_previsao TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  duracao_dias_estimada INTEGER,
  porcentagem INTEGER DEFAULT 0,
  sla_horas INTEGER,
  sla_vencimento TIMESTAMPTZ,
  sla_violado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_id, numero, plataforma)
);

CREATE TABLE app_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES app_clientes(id) ON DELETE CASCADE,
  fase_numero INTEGER NOT NULL,
  texto TEXT NOT NULL,
  descricao TEXT,
  ator TEXT NOT NULL,
  obrigatorio BOOLEAN DEFAULT TRUE,
  feito BOOLEAN DEFAULT FALSE,
  feito_por TEXT,
  feito_em TIMESTAMPTZ,
  tipo TEXT DEFAULT 'check',
  upload_url TEXT,
  upload_validado BOOLEAN DEFAULT FALSE,
  upload_dimensoes_ok BOOLEAN,
  upload_motivo_rejeicao TEXT,
  aprovado_pelo_cliente BOOLEAN,
  aprovado_em TIMESTAMPTZ,
  comentario_cliente TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES app_clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nome_arquivo TEXT,
  url TEXT,
  tamanho_bytes INTEGER,
  largura INTEGER,
  altura INTEGER,
  dimensoes_ok BOOLEAN,
  status TEXT DEFAULT 'aguardando',
  comentario_cliente TEXT,
  aprovado_em TIMESTAMPTZ,
  enviado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_formulario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES app_clientes(id) ON DELETE CASCADE UNIQUE,
  nome_app TEXT,
  descricao_curta TEXT,
  descricao_longa TEXT,
  categoria TEXT,
  palavras_chave TEXT,
  url_privacidade TEXT,
  url_termos TEXT,
  preenchido_completo BOOLEAN DEFAULT FALSE,
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES app_clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  canal TEXT NOT NULL,
  destinatario TEXT,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  enviado BOOLEAN DEFAULT FALSE,
  enviado_em TIMESTAMPTZ,
  erro TEXT,
  agendado_para TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES app_clientes(id) ON DELETE CASCADE,
  fase_numero INTEGER,
  autor TEXT NOT NULL,
  tipo TEXT,
  mensagem TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRIGGERS
-- ============================================

-- TRIGGER 1: Calcular tudo_ok nos pré-requisitos
CREATE OR REPLACE FUNCTION calcular_prereq_ok()
RETURNS TRIGGER AS $$
DECLARE
  plataforma_cliente TEXT;
BEGIN
  SELECT plataforma INTO plataforma_cliente 
  FROM app_clientes WHERE id = NEW.cliente_id;
  
  IF plataforma_cliente = 'google' THEN
    NEW.tudo_ok := (
      NEW.duns_solicitado AND
      COALESCE(NEW.cnpj_tipo, '') IN ('me','ltda') AND
      NEW.email_corporativo IS NOT NULL AND
      NEW.site_publicado AND
      NEW.doc_cnpj_enviado AND
      NEW.doc_identidade_enviado
    );
  ELSIF plataforma_cliente = 'apple' THEN
    NEW.cnpj_bloqueado := (COALESCE(NEW.cnpj_tipo, '') = 'mei');
    NEW.tudo_ok := (
      NOT NEW.cnpj_bloqueado AND
      NEW.duns_solicitado AND
      COALESCE(NEW.cnpj_tipo, '') IN ('me','ltda') AND
      NEW.email_corporativo IS NOT NULL AND
      NEW.site_publicado AND
      NEW.apple_id_corporativo IS NOT NULL
    );
  ELSE
    NEW.cnpj_bloqueado := (COALESCE(NEW.cnpj_tipo, '') = 'mei');
    NEW.tudo_ok := (
      NOT NEW.cnpj_bloqueado AND
      NEW.duns_solicitado AND
      COALESCE(NEW.cnpj_tipo, '') IN ('me','ltda') AND
      NEW.email_corporativo IS NOT NULL AND
      NEW.site_publicado AND
      NEW.doc_cnpj_enviado AND
      NEW.doc_identidade_enviado AND
      NEW.apple_id_corporativo IS NOT NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_prereq_ok
  BEFORE INSERT OR UPDATE ON app_prerequisitos
  FOR EACH ROW EXECUTE FUNCTION calcular_prereq_ok();

-- TRIGGER 2: Recalcular progresso da fase
CREATE OR REPLACE FUNCTION recalcular_progresso_fase()
RETURNS TRIGGER AS $$
DECLARE
  total_items INTEGER;
  items_feitos INTEGER;
  nova_pct INTEGER;
  todos_feitos BOOLEAN;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE feito = true)
  INTO total_items, items_feitos
  FROM app_checklist_items
  WHERE cliente_id = NEW.cliente_id 
    AND fase_numero = NEW.fase_numero
    AND obrigatorio = true;
  
  IF total_items > 0 THEN
    nova_pct := ROUND((items_feitos::NUMERIC / total_items) * 100);
  ELSE
    nova_pct := 0;
  END IF;
  
  todos_feitos := (total_items > 0 AND items_feitos = total_items);
  
  UPDATE app_fases SET
    porcentagem = nova_pct,
    status = CASE 
      WHEN todos_feitos THEN 'concluida'
      WHEN nova_pct > 0 THEN 'em_andamento'
      ELSE status
    END,
    data_conclusao = CASE WHEN todos_feitos THEN NOW() ELSE NULL END
  WHERE cliente_id = NEW.cliente_id AND numero = NEW.fase_numero;
  
  IF todos_feitos THEN
    UPDATE app_clientes SET
      fase_atual = NEW.fase_numero + 1,
      ultima_acao_cliente = NOW()
    WHERE id = NEW.cliente_id AND fase_atual = NEW.fase_numero;
    
    UPDATE app_fases SET
      status = 'em_andamento',
      data_inicio = NOW(),
      sla_vencimento = CASE WHEN sla_horas IS NOT NULL THEN NOW() + (sla_horas || ' hours')::INTERVAL ELSE NULL END
    WHERE cliente_id = NEW.cliente_id 
      AND numero = NEW.fase_numero + 1
      AND status = 'bloqueada';
    
    INSERT INTO app_conversas (cliente_id, fase_numero, autor, tipo, mensagem)
    VALUES (
      NEW.cliente_id, 
      NEW.fase_numero, 
      'Sistema', 
      'sistema',
      '✅ Fase ' || NEW.fase_numero || ' concluída automaticamente em ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI')
    );
    
    INSERT INTO app_notificacoes (cliente_id, tipo, canal, destinatario, titulo, mensagem, agendado_para)
    SELECT 
      NEW.cliente_id,
      'fase_concluida',
      canal,
      'cliente',
      '🎉 Etapa concluída!',
      'Parabéns! Você concluiu mais uma etapa. Acesse o portal para ver o próximo passo.',
      NOW()
    FROM unnest(ARRAY['portal','email']) AS canal;
  END IF;
  
  UPDATE app_clientes SET
    porcentagem_geral = (
      SELECT COALESCE(ROUND(AVG(porcentagem)), 0)
      FROM app_fases
      WHERE cliente_id = NEW.cliente_id AND status != 'bloqueada'
    ),
    ultima_acao_cliente = CASE WHEN NEW.feito THEN NOW() ELSE ultima_acao_cliente END
  WHERE id = NEW.cliente_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_progresso_fase
  AFTER INSERT OR UPDATE ON app_checklist_items
  FOR EACH ROW EXECUTE FUNCTION recalcular_progresso_fase();

-- TRIGGER 3: Verificar SLA violado
CREATE OR REPLACE FUNCTION verificar_sla()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sla_vencimento IS NOT NULL 
     AND NOW() > NEW.sla_vencimento 
     AND NEW.status NOT IN ('concluida') THEN
    NEW.sla_violado := TRUE;
    NEW.status := 'atrasada';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_sla
  BEFORE UPDATE ON app_fases
  FOR EACH ROW EXECUTE FUNCTION verificar_sla();

-- Função para criar fases padrão
CREATE OR REPLACE FUNCTION criar_fases_cliente(p_cliente_id UUID, p_plataforma TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES
    (p_cliente_id, 0, 'Pré-Requisitos', p_plataforma, 'em_andamento', 48, 2),
    (p_cliente_id, 1, 'Primeiros Passos', p_plataforma, 'bloqueada', 48, 3),
    (p_cliente_id, 2, 'Validação pela Loja', p_plataforma, 'bloqueada', 168, 7),
    (p_cliente_id, 3, 'Assets e Mockup', p_plataforma, 'bloqueada', 48, 5),
    (p_cliente_id, 4, 'Formulário do App', p_plataforma, 'bloqueada', 48, 2),
    (p_cliente_id, 5, 'Criação e Submissão', p_plataforma, 'bloqueada', 48, 2),
    (p_cliente_id, 6, 'Aprovação das Lojas', p_plataforma, 'bloqueada', 672, 28),
    (p_cliente_id, 7, 'Teste do App', p_plataforma, 'bloqueada', 48, 2),
    (p_cliente_id, 8, 'Publicado 🎉', p_plataforma, 'bloqueada', NULL, 1);
    
  -- FASE 0
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 0, 'Solicitei o número DUNS da minha empresa', 'Acesse https://www.dnb.com/de-de/upik-en.html e solicite seu número DUNS.', 'cliente', 'link', 1),
    (p_cliente_id, 0, 'Confirmei que meu CNPJ é ME ou LTDA', 'CNPJs MEI não são aceitos pela Apple.', 'cliente', 'check', 2),
    (p_cliente_id, 0, 'Tenho um e-mail corporativo', 'Crie um e-mail no formato email@suaempresa.com.br.', 'cliente', 'check', 3),
    (p_cliente_id, 0, 'Meu site está publicado com domínio próprio', 'O site precisa estar no ar com domínio próprio.', 'cliente', 'check', 4);
    
  -- FASE 1  
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 1, 'Criei a conta no Google Play Console', 'Acesse https://play.google.com/console/signup. Taxa: US$ 25.', 'cliente', 'link', 1),
    (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Google)', 'No Google Play Console → Usuários e permissões.', 'cliente', 'check', 2),
    (p_cliente_id, 1, 'Criei a conta no Apple Developer Program', 'Acesse https://developer.apple.com/account. Taxa: US$ 99/ano.', 'cliente', 'link', 3),
    (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Apple)', 'No App Store Connect → Usuários e acessos.', 'cliente', 'check', 4),
    (p_cliente_id, 1, 'Documentação verificada pelo analista', 'Analista confirma configuração correta.', 'analista', 'check', 5);
    
  -- FASE 3
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 3, 'Ícone do app criado (1024x1024)', 'Designer cria ícone baseado na identidade visual.', 'designer', 'upload', 1),
    (p_cliente_id, 3, 'Splash screen criada (1288x2688)', 'Tela de carregamento do app.', 'designer', 'upload', 2),
    (p_cliente_id, 3, '4 screenshots Google Play - celular', 'Imagens 1242x2688 simulando o app em Android.', 'designer', 'upload', 3),
    (p_cliente_id, 3, '4 screenshots Google Play - tablet', 'Imagens 1242x2208 para tablet Android.', 'designer', 'upload', 4),
    (p_cliente_id, 3, '4 screenshots App Store - iPhone', 'Imagens 1242x2688 para iPhone.', 'designer', 'upload', 5),
    (p_cliente_id, 3, '4 screenshots App Store - iPad', 'Imagens 1242x2208 para iPad.', 'designer', 'upload', 6),
    (p_cliente_id, 3, 'Cliente aprovou todos os assets', 'Cliente visualizou e aprovou os materiais.', 'cliente', 'approval', 7);
    
  -- FASE 4
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 4, 'Nome do aplicativo definido', 'Como o app aparecerá nas lojas.', 'cliente', 'form', 1),
    (p_cliente_id, 4, 'Descrição curta preenchida (até 80 caracteres)', 'Frase de impacto para resultados de busca.', 'cliente', 'form', 2),
    (p_cliente_id, 4, 'Descrição completa preenchida', 'Descrição detalhada (até 4000 caracteres).', 'cliente', 'form', 3),
    (p_cliente_id, 4, 'URL de política de privacidade informada', 'Link para a página de privacidade.', 'cliente', 'form', 4),
    (p_cliente_id, 4, 'Formulário validado pelo analista', 'Analista revisa informações.', 'analista', 'check', 5);
    
  -- FASE 5
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 5, 'Build do aplicativo gerado', 'Dev gera o build.', 'analista', 'check', 1),
    (p_cliente_id, 5, 'App submetido para Google Play', 'Enviado para análise na Google Play.', 'analista', 'check', 2),
    (p_cliente_id, 5, 'App submetido para App Store', 'Enviado para análise na App Store.', 'analista', 'check', 3);
    
  -- FASE 7
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 7, 'Fiz login no app de teste', 'Acessei o app com minha conta.', 'cliente', 'check', 1),
    (p_cliente_id, 7, 'Naveguei pelo conteúdo principal', 'Verifiquei cursos e conteúdos.', 'cliente', 'check', 2),
    (p_cliente_id, 7, 'Aprovei o app para publicação', 'Confirmo que o app está pronto.', 'cliente', 'approval', 3);

  -- Criar pré-requisitos
  INSERT INTO app_prerequisitos (cliente_id) VALUES (p_cliente_id);
  
  -- Criar formulário vazio
  INSERT INTO app_formulario (cliente_id) VALUES (p_cliente_id);
  
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar fases ao inserir cliente
CREATE OR REPLACE FUNCTION trigger_criar_fases()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM criar_fases_cliente(NEW.id, NEW.plataforma);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_novo_cliente_fases
  AFTER INSERT ON app_clientes
  FOR EACH ROW EXECUTE FUNCTION trigger_criar_fases();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE app_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_prerequisitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_formulario ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe acessa app_clientes" ON app_clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Equipe acessa app_prerequisitos" ON app_prerequisitos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Equipe acessa app_fases" ON app_fases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Equipe acessa app_checklist_items" ON app_checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Equipe acessa app_assets" ON app_assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Equipe acessa app_formulario" ON app_formulario FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Equipe acessa app_notificacoes" ON app_notificacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Equipe acessa app_conversas" ON app_conversas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Portal público (anon)
CREATE POLICY "Portal cliente le app_clientes" ON app_clientes FOR SELECT TO anon USING (true);
CREATE POLICY "Portal cliente le app_fases" ON app_fases FOR SELECT TO anon USING (true);
CREATE POLICY "Portal cliente le app_checklist" ON app_checklist_items FOR SELECT TO anon USING (true);
CREATE POLICY "Portal cliente atualiza checklist" ON app_checklist_items FOR UPDATE TO anon USING (ator = 'cliente') WITH CHECK (ator = 'cliente');
CREATE POLICY "Portal cliente le assets" ON app_assets FOR SELECT TO anon USING (true);
CREATE POLICY "Portal cliente aprova assets" ON app_assets FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Portal cliente le formulario" ON app_formulario FOR SELECT TO anon USING (true);
CREATE POLICY "Portal cliente atualiza formulario" ON app_formulario FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Portal cliente le prerequisitos" ON app_prerequisitos FOR SELECT TO anon USING (true);
CREATE POLICY "Portal cliente atualiza prerequisitos" ON app_prerequisitos FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Portal cliente le conversas" ON app_conversas FOR SELECT TO anon USING (true);
CREATE POLICY "Portal cliente insere conversa" ON app_conversas FOR INSERT TO anon WITH CHECK (tipo = 'cliente');
