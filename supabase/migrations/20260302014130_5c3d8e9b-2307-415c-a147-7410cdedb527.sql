
CREATE OR REPLACE FUNCTION public.criar_fases_cliente(p_cliente_id uuid, p_plataforma text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES
    (p_cliente_id, 0, 'Pré-Requisitos', p_plataforma, 'em_andamento', 48, 2),
    (p_cliente_id, 1, 'Primeiros Passos', p_plataforma, 'bloqueada', 48, 3),
    (p_cliente_id, 2, 'Validação pela Loja', p_plataforma, 'bloqueada', 168, 7),
    (p_cliente_id, 3, 'Criação e Submissão', p_plataforma, 'bloqueada', 48, 5),
    (p_cliente_id, 4, 'Aprovação das Lojas', p_plataforma, 'bloqueada', 672, 28),
    (p_cliente_id, 5, 'Teste do App', p_plataforma, 'bloqueada', 48, 2),
    (p_cliente_id, 6, 'Publicado 🎉', p_plataforma, 'bloqueada', NULL, 1);
    
  -- FASE 0 - Pré-Requisitos
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 0, 'Solicitei o número DUNS da minha empresa', 'Acesse https://www.dnb.com/de-de/upik-en.html e solicite seu número DUNS.', 'cliente', 'link', 1),
    (p_cliente_id, 0, 'Confirmei que meu CNPJ é ME ou LTDA', 'CNPJs MEI não são aceitos pela Apple.', 'cliente', 'check', 2),
    (p_cliente_id, 0, 'Tenho um e-mail corporativo', 'Crie um e-mail no formato email@suaempresa.com.br.', 'cliente', 'check', 3),
    (p_cliente_id, 0, 'Meu site está publicado com domínio próprio', 'O site precisa estar no ar com domínio próprio.', 'cliente', 'check', 4),
    (p_cliente_id, 0, 'Ícone do app criado (1024x1024)', 'Designer cria ícone baseado na identidade visual.', 'designer', 'upload', 5),
    (p_cliente_id, 0, 'Splash screen criada (1288x2688)', 'Tela de carregamento do app.', 'designer', 'upload', 6),
    (p_cliente_id, 0, '4 screenshots Google Play - celular', 'Imagens 1242x2688 simulando o app em Android.', 'designer', 'upload', 7),
    (p_cliente_id, 0, '4 screenshots Google Play - tablet', 'Imagens 1242x2208 para tablet Android.', 'designer', 'upload', 8),
    (p_cliente_id, 0, '4 screenshots App Store - iPhone', 'Imagens 1242x2688 para iPhone.', 'designer', 'upload', 9),
    (p_cliente_id, 0, '4 screenshots App Store - iPad', 'Imagens 1242x2208 para iPad.', 'designer', 'upload', 10),
    (p_cliente_id, 0, 'Cliente aprovou todos os assets', 'Cliente visualizou e aprovou os materiais.', 'cliente', 'approval', 11);
    
  -- FASE 1 - Primeiros Passos
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 1, 'Criei a conta no Google Play Console', 'Acesse https://play.google.com/console/signup. Taxa: US$ 25.', 'cliente', 'link', 1),
    (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Google)', 'No Google Play Console → Usuários e permissões.', 'cliente', 'check', 2),
    (p_cliente_id, 1, 'Criei a conta no Apple Developer Program', 'Acesse https://developer.apple.com/account. Taxa: US$ 99/ano.', 'cliente', 'link', 3),
    (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Apple)', 'No App Store Connect → Usuários e acessos.', 'cliente', 'check', 4),
    (p_cliente_id, 1, 'Documentação verificada pelo analista', 'Analista confirma configuração correta.', 'analista', 'check', 5);

  -- FASE 2 - Validação pela Loja (pendências do analista)
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 2, 'Validar conta Google Play do cliente', 'Verificar que a conta do cliente foi aceita e está ativa.', 'analista', 'check', 1),
    (p_cliente_id, 2, 'Validar conta Apple Developer do cliente', 'Verificar que a conta do cliente foi aceita e está ativa.', 'analista', 'check', 2);
    
  -- FASE 3 - Criação e Submissão
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 3, 'Formulário do aplicativo', 'Preencha as informações do seu app para as lojas.', 'cliente', 'form', 1),
    (p_cliente_id, 3, 'Desenvolvimento e Submissão do aplicativo pela Curseduca', 'A equipe Curseduca irá desenvolver e submeter o app nas lojas.', 'analista', 'check', 2);

  -- FASE 4 - Aprovação das Lojas (pendências do analista)
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 4, 'Aguardar aprovação do Google Play', 'Monitorar status da aprovação do app no Google Play.', 'analista', 'check', 1),
    (p_cliente_id, 4, 'Aguardar aprovação da App Store', 'Monitorar status da aprovação do app na App Store.', 'analista', 'check', 2);
    
  -- FASE 5 - Teste do App
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
  VALUES
    (p_cliente_id, 5, 'Fiz login no app de teste', 'Acessei o app com minha conta.', 'cliente', 'check', 1),
    (p_cliente_id, 5, 'Naveguei pelo conteúdo principal', 'Verifiquei cursos e conteúdos.', 'cliente', 'check', 2),
    (p_cliente_id, 5, 'Aprovei o app para publicação', 'Confirmo que o app está pronto.', 'cliente', 'approval_final', 3);

  -- Criar pré-requisitos
  INSERT INTO app_prerequisitos (cliente_id) VALUES (p_cliente_id);
  
  -- Criar formulário vazio
  INSERT INTO app_formulario (cliente_id) VALUES (p_cliente_id);
  
END;
$function$;
