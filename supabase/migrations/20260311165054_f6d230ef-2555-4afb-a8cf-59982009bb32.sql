
-- Recreate criar_fases_cliente: single journey, F3 with Apple/Google activities, no F5
-- Phase structure: 0=Pré-Requisitos, 1=Primeiros Passos, 2=Validação pela Loja, 3=Criação e Submissão, 4=Aprovação das Lojas, 5=Publicado
CREATE OR REPLACE FUNCTION public.criar_fases_cliente(p_cliente_id uuid, p_plataforma text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Fase 0: Pré-Requisitos (única)
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES (p_cliente_id, 0, 'Pré-Requisitos', 'compartilhada', 'em_andamento', 48, 2);

  -- Fase 1: Primeiros Passos (única)
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES (p_cliente_id, 1, 'Primeiros Passos', 'compartilhada', 'bloqueada', 48, 3);

  -- Fase 2: Validação pela Loja (única)
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES (p_cliente_id, 2, 'Validação pela Loja', 'compartilhada', 'bloqueada', 168, 7);

  -- Fase 3: Criação e Submissão (única, com atividades internas separadas por plataforma)
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES (p_cliente_id, 3, 'Criação e Submissão', 'compartilhada', 'bloqueada', 48, 5);

  -- Fase 4: Aprovação das Lojas (única)
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES (p_cliente_id, 4, 'Aprovação das Lojas', 'compartilhada', 'bloqueada', 672, 28);

  -- Fase 5: Publicado (única)
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES (p_cliente_id, 5, 'Publicado 🎉', 'compartilhada', 'bloqueada', NULL, 1);

  -- Checklist Fase 0 (compartilhada)
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
    (p_cliente_id, 0, 'Solicitei o número DUNS da minha empresa', 'Acesse https://www.dnb.com/de-de/upik-en.html', 'cliente', 'link', 1, 'compartilhada'),
    (p_cliente_id, 0, 'Confirmei que meu CNPJ é ME ou LTDA', 'CNPJs MEI não são aceitos pela Apple.', 'cliente', 'check', 2, 'compartilhada'),
    (p_cliente_id, 0, 'Tenho um e-mail corporativo', 'email@suaempresa.com.br', 'cliente', 'check', 3, 'compartilhada'),
    (p_cliente_id, 0, 'Meu site está publicado com domínio próprio', 'Domínio próprio.', 'cliente', 'check', 4, 'compartilhada');

  -- Checklist Fase 1
  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 1, 'Criei a conta no Google Play Console', 'Acesse https://play.google.com/console/signup. Taxa: US$ 25.', 'cliente', 'link', 1, 'google'),
      (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Google)', 'No Google Play Console → Usuários e permissões → Administrador.', 'cliente', 'check', 2, 'google');
  END IF;
  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 1, 'Criei a conta no Apple Developer Program', 'Acesse https://developer.apple.com/account. Taxa: US$ 99/ano.', 'cliente', 'link', 1, 'apple'),
      (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Apple)', 'No App Store Connect → Usuários e acessos.', 'cliente', 'check', 2, 'apple');
  END IF;
  -- Analyst validation for fase 1
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
    (p_cliente_id, 1, 'Documentação verificada pelo analista', 'Analista confirma configuração correta.', 'analista', 'check', 10, 'compartilhada');

  -- Checklist Fase 3: separate Apple/Google activities with default analyst
  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma, responsavel) VALUES
      (p_cliente_id, 3, 'Formulário do aplicativo (Google)', 'Informações para Google Play.', 'cliente', 'form', 1, 'google', NULL),
      (p_cliente_id, 3, 'Criação e Submissão — Google', 'Equipe submete na Google Play.', 'analista', 'check', 2, 'google', 'Jamerson');
  END IF;
  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma, responsavel) VALUES
      (p_cliente_id, 3, 'Formulário do aplicativo (Apple)', 'Informações para App Store.', 'cliente', 'form', 1, 'apple', NULL),
      (p_cliente_id, 3, 'Criação e Submissão — Apple', 'Equipe submete na App Store.', 'analista', 'check', 2, 'apple', 'Luiz Gustavo');
  END IF;

  -- Checklist Fase 5: Publicado (analista confirma URL)
  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 5, 'Confirmar publicação e informar URL (Google Play)', 'Preencha a URL do app na Google Play Store para notificar o cliente. Prazo: 1 dia útil.', 'analista', 'publicacao_url', 1, 'google');
  END IF;
  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 5, 'Confirmar publicação e informar URL (App Store)', 'Preencha a URL do app na App Store para notificar o cliente. Prazo: 1 dia útil.', 'analista', 'publicacao_url', 1, 'apple');
  END IF;

  INSERT INTO app_prerequisitos (cliente_id) VALUES (p_cliente_id);
  INSERT INTO app_formulario (cliente_id) VALUES (p_cliente_id);
END;
$function$;

-- Update recalcular_progresso_fase to use new phase numbers (5=Publicado instead of 6)
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
  item_plataforma TEXT;
  fase_plataforma TEXT;
  existing_publish_item INTEGER;
BEGIN
  item_plataforma := COALESCE(NEW.plataforma, 'compartilhada');
  fase_plataforma := 'compartilhada';

  -- For phase 3: consider ALL items (client + analyst + designer)
  -- For all other phases: consider only CLIENT items for progression
  IF NEW.fase_numero = 3 THEN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE feito = TRUE)
    INTO total_items, items_feitos
    FROM app_checklist_items
    WHERE cliente_id = NEW.cliente_id 
      AND fase_numero = NEW.fase_numero;
  ELSE
    SELECT COUNT(*), COUNT(*) FILTER (WHERE feito = TRUE)
    INTO total_items, items_feitos
    FROM app_checklist_items
    WHERE cliente_id = NEW.cliente_id 
      AND fase_numero = NEW.fase_numero
      AND ator = 'cliente';
  END IF;

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
  WHERE cliente_id = NEW.cliente_id 
    AND numero = NEW.fase_numero
    AND plataforma = 'compartilhada';

  IF todos_feitos THEN
    -- Auto-advance to next phase
    IF NEW.fase_numero BETWEEN 0 AND 4 THEN
      UPDATE app_fases SET
        status = 'em_andamento',
        data_inicio = NOW(),
        sla_vencimento = CASE WHEN sla_horas IS NOT NULL THEN NOW() + (sla_horas || ' hours')::INTERVAL ELSE NULL END
      WHERE cliente_id = NEW.cliente_id 
        AND numero = NEW.fase_numero + 1 
        AND status = 'bloqueada';
    END IF;

    -- Phase 4 done = approval done, notify for publication
    IF NEW.fase_numero = 4 THEN
      INSERT INTO app_notificacoes (cliente_id, tipo, canal, destinatario, titulo, mensagem, agendado_para)
      VALUES (
        NEW.cliente_id, 'publicacao_pendente', 'portal', 'analista',
        '🚀 App aprovado — publicar nas lojas',
        'Cliente aprovou o app. Publique nas lojas.',
        NOW()
      );
    END IF;

    INSERT INTO app_conversas (cliente_id, fase_numero, autor, tipo, mensagem)
    VALUES (
      NEW.cliente_id, NEW.fase_numero, 'Sistema', 'sistema',
      '✅ Fase ' || NEW.fase_numero || ' concluída em ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI')
    );

    INSERT INTO app_notificacoes (cliente_id, tipo, canal, destinatario, titulo, mensagem, agendado_para)
    SELECT NEW.cliente_id, 'fase_concluida', canal, 'cliente',
      '🎉 Etapa concluída!', 'Parabéns! Mais uma etapa concluída.', NOW()
    FROM unnest(ARRAY['portal','email']) AS canal;
  END IF;

  UPDATE app_clientes SET
    fase_atual = COALESCE(
      (SELECT MIN(numero) FROM app_fases 
       WHERE cliente_id = NEW.cliente_id AND status != 'concluida'),
      6
    ),
    ultima_acao_cliente = CASE WHEN NEW.feito THEN NOW() ELSE ultima_acao_cliente END
  WHERE id = NEW.cliente_id;

  -- Check if all phases done (fase 5 = Publicado)
  IF NOT EXISTS (
    SELECT 1 FROM app_fases 
    WHERE cliente_id = NEW.cliente_id AND numero = 5 AND status != 'concluida'
  ) AND EXISTS (
    SELECT 1 FROM app_fases WHERE cliente_id = NEW.cliente_id AND numero = 5
  ) THEN
    UPDATE app_clientes SET status = 'concluido' WHERE id = NEW.cliente_id;
  END IF;

  -- Overall progress
  SELECT COUNT(*), COUNT(*) FILTER (WHERE feito = TRUE)
  INTO total_checklist_all, done_checklist_all
  FROM app_checklist_items
  WHERE cliente_id = NEW.cliente_id;

  UPDATE app_clientes SET
    porcentagem_geral = CASE 
      WHEN total_checklist_all > 0 THEN ROUND((done_checklist_all::NUMERIC / total_checklist_all) * 100)
      ELSE 0
    END
  WHERE id = NEW.cliente_id;

  RETURN NEW;
END;
$function$;
