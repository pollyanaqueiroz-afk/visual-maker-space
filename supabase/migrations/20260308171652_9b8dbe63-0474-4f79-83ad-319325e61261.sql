
-- Drop and recreate criar_fases_cliente with fully independent tracks (phases 5-6 per platform)
CREATE OR REPLACE FUNCTION public.criar_fases_cliente(p_cliente_id uuid, p_plataforma text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- ===== FASES =====
  -- Phase 0: always shared
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES (p_cliente_id, 0, 'Pré-Requisitos', 'compartilhada', 'em_andamento', 48, 2);

  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada) VALUES
      (p_cliente_id, 1, 'Primeiros Passos', 'google', 'bloqueada', 48, 3),
      (p_cliente_id, 2, 'Validação pela Loja', 'google', 'bloqueada', 168, 7),
      (p_cliente_id, 3, 'Criação e Submissão', 'google', 'bloqueada', 48, 5),
      (p_cliente_id, 4, 'Aprovação das Lojas', 'google', 'bloqueada', 672, 28),
      (p_cliente_id, 5, 'Teste do App', 'google', 'bloqueada', 48, 2),
      (p_cliente_id, 6, 'Publicado 🎉', 'google', 'bloqueada', NULL, 1);
  END IF;

  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada) VALUES
      (p_cliente_id, 1, 'Primeiros Passos', 'apple', 'bloqueada', 48, 3),
      (p_cliente_id, 2, 'Validação pela Loja', 'apple', 'bloqueada', 168, 7),
      (p_cliente_id, 3, 'Criação e Submissão', 'apple', 'bloqueada', 48, 5),
      (p_cliente_id, 4, 'Aprovação das Lojas', 'apple', 'bloqueada', 672, 28),
      (p_cliente_id, 5, 'Teste do App', 'apple', 'bloqueada', 48, 2),
      (p_cliente_id, 6, 'Publicado 🎉', 'apple', 'bloqueada', NULL, 1);
  END IF;

  IF p_plataforma NOT IN ('ambos', 'google', 'apple') THEN
    -- Fallback: single platform linear
    INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada) VALUES
      (p_cliente_id, 1, 'Primeiros Passos', p_plataforma, 'bloqueada', 48, 3),
      (p_cliente_id, 2, 'Validação pela Loja', p_plataforma, 'bloqueada', 168, 7),
      (p_cliente_id, 3, 'Criação e Submissão', p_plataforma, 'bloqueada', 48, 5),
      (p_cliente_id, 4, 'Aprovação das Lojas', p_plataforma, 'bloqueada', 672, 28),
      (p_cliente_id, 5, 'Teste do App', p_plataforma, 'bloqueada', 48, 2),
      (p_cliente_id, 6, 'Publicado 🎉', p_plataforma, 'bloqueada', NULL, 1);
  END IF;

  -- ===== CHECKLIST ITEMS =====
  
  -- FASE 0 - Pré-Requisitos (always shared)
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma)
  VALUES
    (p_cliente_id, 0, 'Solicitei o número DUNS da minha empresa', 'Acesse https://www.dnb.com/de-de/upik-en.html e solicite seu número DUNS.', 'cliente', 'link', 1, 'compartilhada'),
    (p_cliente_id, 0, 'Confirmei que meu CNPJ é ME ou LTDA', 'CNPJs MEI não são aceitos pela Apple.', 'cliente', 'check', 2, 'compartilhada'),
    (p_cliente_id, 0, 'Tenho um e-mail corporativo', 'Crie um e-mail no formato email@suaempresa.com.br.', 'cliente', 'check', 3, 'compartilhada'),
    (p_cliente_id, 0, 'Meu site está publicado com domínio próprio', 'O site precisa estar no ar com domínio próprio.', 'cliente', 'check', 4, 'compartilhada'),
    (p_cliente_id, 0, 'Ícone do app criado (1024x1024)', 'Designer cria ícone baseado na identidade visual.', 'designer', 'upload', 5, 'compartilhada'),
    (p_cliente_id, 0, 'Splash screen criada (1288x2688)', 'Tela de carregamento do app.', 'designer', 'upload', 6, 'compartilhada'),
    (p_cliente_id, 0, '4 screenshots Google Play - celular', 'Imagens 1242x2688 simulando o app em Android.', 'designer', 'upload', 7, 'compartilhada'),
    (p_cliente_id, 0, '4 screenshots Google Play - tablet', 'Imagens 1242x2208 para tablet Android.', 'designer', 'upload', 8, 'compartilhada'),
    (p_cliente_id, 0, '4 screenshots App Store - iPhone', 'Imagens 1242x2688 para iPhone.', 'designer', 'upload', 9, 'compartilhada'),
    (p_cliente_id, 0, '4 screenshots App Store - iPad', 'Imagens 1242x2208 para iPad.', 'designer', 'upload', 10, 'compartilhada'),
    (p_cliente_id, 0, 'Cliente aprovou todos os assets', 'Cliente visualizou e aprovou os materiais.', 'cliente', 'approval', 11, 'compartilhada');

  IF p_plataforma = 'ambos' THEN
    -- FASE 1 - Primeiros Passos: split by platform
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 1, 'Criei a conta no Google Play Console', 'Acesse https://play.google.com/console/signup. Taxa: US$ 25.', 'cliente', 'link', 1, 'google'),
      (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Google)', 'No Google Play Console → Usuários e permissões.', 'cliente', 'check', 2, 'google'),
      (p_cliente_id, 1, 'Documentação Google verificada pelo analista', 'Analista confirma configuração correta.', 'analista', 'check', 3, 'google'),
      (p_cliente_id, 1, 'Criei a conta no Apple Developer Program', 'Acesse https://developer.apple.com/account. Taxa: US$ 99/ano.', 'cliente', 'link', 1, 'apple'),
      (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Apple)', 'No App Store Connect → Usuários e acessos.', 'cliente', 'check', 2, 'apple'),
      (p_cliente_id, 1, 'Documentação Apple verificada pelo analista', 'Analista confirma configuração correta.', 'analista', 'check', 3, 'apple');

    -- FASE 2 - Validação pela Loja: per platform
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 2, 'Validar conta Google Play do cliente', 'Verificar que a conta do cliente foi aceita e está ativa.', 'analista', 'check', 1, 'google'),
      (p_cliente_id, 2, 'Validar conta Apple Developer do cliente', 'Verificar que a conta do cliente foi aceita e está ativa.', 'analista', 'check', 1, 'apple');

    -- FASE 3 - Criação e Submissão: per platform
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 3, 'Formulário do aplicativo (Google)', 'Preencha as informações do seu app para o Google Play.', 'cliente', 'form', 1, 'google'),
      (p_cliente_id, 3, 'Submissão do app no Google Play', 'A equipe Curseduca irá submeter o app no Google Play.', 'analista', 'check', 2, 'google'),
      (p_cliente_id, 3, 'Formulário do aplicativo (Apple)', 'Preencha as informações do seu app para a App Store.', 'cliente', 'form', 1, 'apple'),
      (p_cliente_id, 3, 'Submissão do app na App Store', 'A equipe Curseduca irá submeter o app na App Store.', 'analista', 'check', 2, 'apple');

    -- FASE 4 - Aprovação: per platform
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 4, 'Aguardar aprovação do Google Play', 'Monitorar status da aprovação do app no Google Play.', 'analista', 'check', 1, 'google'),
      (p_cliente_id, 4, 'Aguardar aprovação da App Store', 'Monitorar status da aprovação do app na App Store.', 'analista', 'check', 1, 'apple');

    -- FASE 5 - Teste do App: per platform
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 5, 'Fiz login no app de teste (Google)', 'Testei o app Android.', 'cliente', 'check', 1, 'google'),
      (p_cliente_id, 5, 'Naveguei pelo conteúdo principal (Google)', 'Verifiquei cursos no Android.', 'cliente', 'check', 2, 'google'),
      (p_cliente_id, 5, 'Aprovei o app para publicação (Google)', 'App Android está pronto.', 'cliente', 'approval_final', 3, 'google'),
      (p_cliente_id, 5, 'Fiz login no app de teste (Apple)', 'Testei o app iOS.', 'cliente', 'check', 1, 'apple'),
      (p_cliente_id, 5, 'Naveguei pelo conteúdo principal (Apple)', 'Verifiquei cursos no iOS.', 'cliente', 'check', 2, 'apple'),
      (p_cliente_id, 5, 'Aprovei o app para publicação (Apple)', 'App iOS está pronto.', 'cliente', 'approval_final', 3, 'apple');

  ELSE
    -- Single platform: linear checklist items
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 1, 'Criei a conta no Google Play Console', 'Acesse https://play.google.com/console/signup. Taxa: US$ 25.', 'cliente', 'link', 1, p_plataforma),
      (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Google)', 'No Google Play Console → Usuários e permissões.', 'cliente', 'check', 2, p_plataforma),
      (p_cliente_id, 1, 'Criei a conta no Apple Developer Program', 'Acesse https://developer.apple.com/account. Taxa: US$ 99/ano.', 'cliente', 'link', 3, p_plataforma),
      (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Apple)', 'No App Store Connect → Usuários e acessos.', 'cliente', 'check', 4, p_plataforma),
      (p_cliente_id, 1, 'Documentação verificada pelo analista', 'Analista confirma configuração correta.', 'analista', 'check', 5, p_plataforma);

    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 2, 'Validar conta Google Play do cliente', 'Verificar que a conta do cliente foi aceita e está ativa.', 'analista', 'check', 1, p_plataforma),
      (p_cliente_id, 2, 'Validar conta Apple Developer do cliente', 'Verificar que a conta do cliente foi aceita e está ativa.', 'analista', 'check', 2, p_plataforma);

    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 3, 'Formulário do aplicativo', 'Preencha as informações do seu app para as lojas.', 'cliente', 'form', 1, p_plataforma),
      (p_cliente_id, 3, 'Desenvolvimento e Submissão do aplicativo pela Curseduca', 'A equipe Curseduca irá desenvolver e submeter o app nas lojas.', 'analista', 'check', 2, p_plataforma);

    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 4, 'Aguardar aprovação do Google Play', 'Monitorar status da aprovação do app no Google Play.', 'analista', 'check', 1, p_plataforma),
      (p_cliente_id, 4, 'Aguardar aprovação da App Store', 'Monitorar status da aprovação do app na App Store.', 'analista', 'check', 2, p_plataforma);

    -- FASE 5 - single platform
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 5, 'Fiz login no app de teste', 'Acessei o app com minha conta.', 'cliente', 'check', 1, p_plataforma),
      (p_cliente_id, 5, 'Naveguei pelo conteúdo principal', 'Verifiquei cursos e conteúdos.', 'cliente', 'check', 2, p_plataforma),
      (p_cliente_id, 5, 'Aprovei o app para publicação', 'Confirmo que o app está pronto.', 'cliente', 'approval_final', 3, p_plataforma);
  END IF;

  -- Create prerequisites
  INSERT INTO app_prerequisitos (cliente_id) VALUES (p_cliente_id);
  
  -- Create empty form
  INSERT INTO app_formulario (cliente_id) VALUES (p_cliente_id);

END;
$function$;

-- Update recalcular_progresso_fase for fully independent tracks
CREATE OR REPLACE FUNCTION public.recalcular_progresso_fase()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  total_items INTEGER;
  items_feitos INTEGER;
  nova_pct INTEGER;
  todos_feitos BOOLEAN;
  total_checklist_all INTEGER;
  done_checklist_all INTEGER;
  existing_publish_item INTEGER;
  current_fase INTEGER;
  item_plataforma TEXT;
  min_incomplete_fase INTEGER;
  cliente_plataforma TEXT;
  all_fase6_done BOOLEAN;
BEGIN
  -- Get the platform of the checklist item being changed
  item_plataforma := NEW.plataforma;
  
  -- Get client's overall platform setting
  SELECT plataforma INTO cliente_plataforma FROM app_clientes WHERE id = NEW.cliente_id;

  -- Calculate progress for this specific fase+platform combo
  IF item_plataforma = 'compartilhada' OR cliente_plataforma NOT IN ('ambos') THEN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE feito = TRUE)
    INTO total_items, items_feitos
    FROM app_checklist_items
    WHERE cliente_id = NEW.cliente_id AND fase_numero = NEW.fase_numero;
  ELSE
    SELECT COUNT(*), COUNT(*) FILTER (WHERE feito = TRUE)
    INTO total_items, items_feitos
    FROM app_checklist_items
    WHERE cliente_id = NEW.cliente_id 
      AND fase_numero = NEW.fase_numero 
      AND plataforma = item_plataforma;
  END IF;

  IF total_items > 0 THEN
    nova_pct := ROUND((items_feitos::NUMERIC / total_items) * 100);
  ELSE
    nova_pct := 0;
  END IF;

  todos_feitos := (total_items > 0 AND items_feitos = total_items);

  -- Update the correct fase row
  IF cliente_plataforma = 'ambos' AND item_plataforma != 'compartilhada' THEN
    UPDATE app_fases SET
      porcentagem = nova_pct,
      status = CASE 
        WHEN todos_feitos THEN 'concluida'
        WHEN nova_pct > 0 THEN 'em_andamento'
        ELSE status
      END,
      data_conclusao = CASE WHEN todos_feitos THEN NOW() ELSE NULL END
    WHERE cliente_id = NEW.cliente_id 
      AND numero = NEW.fase_numero 
      AND plataforma = item_plataforma;
  ELSE
    UPDATE app_fases SET
      porcentagem = nova_pct,
      status = CASE 
        WHEN todos_feitos THEN 'concluida'
        WHEN nova_pct > 0 THEN 'em_andamento'
        ELSE status
      END,
      data_conclusao = CASE WHEN todos_feitos THEN NOW() ELSE NULL END
    WHERE cliente_id = NEW.cliente_id 
      AND numero = NEW.fase_numero
      AND (plataforma = 'compartilhada' OR plataforma = cliente_plataforma);
  END IF;

  -- Handle phase completion and unlocking
  IF todos_feitos THEN
    INSERT INTO app_conversas (cliente_id, fase_numero, autor, tipo, mensagem)
    VALUES (
      NEW.cliente_id, NEW.fase_numero, 'Sistema', 'sistema',
      '✅ Fase ' || NEW.fase_numero || 
      CASE WHEN item_plataforma != 'compartilhada' THEN ' (' || item_plataforma || ')' ELSE '' END ||
      ' concluída em ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI')
    );

    IF NEW.fase_numero = 0 THEN
      -- Phase 0 done -> unlock ALL phase 1 fases
      UPDATE app_fases SET
        status = 'em_andamento',
        data_inicio = NOW(),
        sla_vencimento = CASE WHEN sla_horas IS NOT NULL THEN NOW() + (sla_horas || ' hours')::INTERVAL ELSE NULL END
      WHERE cliente_id = NEW.cliente_id 
        AND numero = 1
        AND status = 'bloqueada';

    ELSIF NEW.fase_numero BETWEEN 1 AND 5 THEN
      -- Each phase unlocks the NEXT phase for the SAME platform only
      IF cliente_plataforma = 'ambos' AND item_plataforma != 'compartilhada' THEN
        UPDATE app_fases SET
          status = 'em_andamento',
          data_inicio = NOW(),
          sla_vencimento = CASE WHEN sla_horas IS NOT NULL THEN NOW() + (sla_horas || ' hours')::INTERVAL ELSE NULL END
        WHERE cliente_id = NEW.cliente_id 
          AND numero = NEW.fase_numero + 1
          AND plataforma = item_plataforma
          AND status = 'bloqueada';
      ELSE
        UPDATE app_fases SET
          status = 'em_andamento',
          data_inicio = NOW(),
          sla_vencimento = CASE WHEN sla_horas IS NOT NULL THEN NOW() + (sla_horas || ' hours')::INTERVAL ELSE NULL END
        WHERE cliente_id = NEW.cliente_id 
          AND numero = NEW.fase_numero + 1
          AND status = 'bloqueada';
      END IF;

      -- If fase 5 completed, create publish item for fase 6 of same platform
      IF NEW.fase_numero = 5 THEN
        SELECT COUNT(*) INTO existing_publish_item
        FROM app_checklist_items
        WHERE cliente_id = NEW.cliente_id AND fase_numero = 6 AND plataforma = item_plataforma;

        IF existing_publish_item = 0 THEN
          INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma)
          VALUES (NEW.cliente_id, 6, 
            CASE WHEN item_plataforma = 'google' THEN 'Publicar na loja (Google Play)'
                 WHEN item_plataforma = 'apple' THEN 'Publicar na loja (App Store)'
                 ELSE 'Publicar na loja' END,
            'O analista irá publicar o aplicativo na loja oficial.', 'analista', 'check', 1, item_plataforma);
        END IF;

        INSERT INTO app_notificacoes (cliente_id, tipo, canal, destinatario, titulo, mensagem, agendado_para)
        VALUES (
          NEW.cliente_id, 'publicacao_pendente', 'portal', 'analista',
          '🚀 App aprovado pelo cliente — publicar ' || 
          CASE WHEN item_plataforma = 'google' THEN 'no Google Play'
               WHEN item_plataforma = 'apple' THEN 'na App Store'
               ELSE 'na loja' END,
          'O cliente aprovou o app de teste. Publique o aplicativo.', NOW()
        );
      END IF;
    END IF;

    -- Send notification
    INSERT INTO app_notificacoes (cliente_id, tipo, canal, destinatario, titulo, mensagem, agendado_para)
    SELECT NEW.cliente_id, 'fase_concluida', canal, 'cliente',
      '🎉 Etapa concluída!', 
      'Parabéns! Você concluiu mais uma etapa' || 
      CASE WHEN item_plataforma != 'compartilhada' THEN ' (' || item_plataforma || ')' ELSE '' END || 
      '. Acesse o portal para ver o próximo passo.', NOW()
    FROM unnest(ARRAY['portal','email']) AS canal;
  END IF;

  -- Calculate fase_atual = MIN of incomplete fase numbers
  SELECT COALESCE(MIN(numero), 6) INTO min_incomplete_fase
  FROM app_fases
  WHERE cliente_id = NEW.cliente_id AND status != 'concluida';

  UPDATE app_clientes SET fase_atual = min_incomplete_fase WHERE id = NEW.cliente_id;

  -- Get updated fase_atual
  SELECT fase_atual INTO current_fase FROM app_clientes WHERE id = NEW.cliente_id;

  -- Check if ALL fase 6 are done (app fully published)
  SELECT NOT EXISTS (
    SELECT 1 FROM app_fases 
    WHERE cliente_id = NEW.cliente_id AND numero = 6 AND status != 'concluida'
  ) INTO all_fase6_done;

  IF all_fase6_done AND current_fase >= 6 THEN
    UPDATE app_clientes SET porcentagem_geral = 100 WHERE id = NEW.cliente_id;
  ELSE
    SELECT COUNT(*), COUNT(*) FILTER (WHERE feito = TRUE)
    INTO total_checklist_all, done_checklist_all
    FROM app_checklist_items
    WHERE cliente_id = NEW.cliente_id;

    UPDATE app_clientes SET
      porcentagem_geral = CASE 
        WHEN total_checklist_all > 0 THEN ROUND((done_checklist_all::NUMERIC / total_checklist_all) * 100)
        ELSE 0
      END,
      ultima_acao_cliente = CASE WHEN NEW.feito THEN NOW() ELSE ultima_acao_cliente END
    WHERE id = NEW.cliente_id;
  END IF;

  RETURN NEW;
END;
$function$;
