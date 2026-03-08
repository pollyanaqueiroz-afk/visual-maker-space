
-- 1) Delete obsolete asset-related checklist items from fase 0
DELETE FROM app_checklist_items 
WHERE fase_numero = 0 
AND (
  texto ILIKE '%Ícone do app%' 
  OR texto ILIKE '%Splash screen%' 
  OR texto ILIKE '%screenshots Google Play%' 
  OR texto ILIKE '%screenshots App Store%' 
  OR texto ILIKE '%aprovou todos os assets%'
  OR texto ILIKE '%Ícone do App%'
  OR texto ILIKE '%splash%screen%'
  OR texto ILIKE '%screenshot%'
);

-- 2) Update criar_fases_cliente to not create asset items in fase 0
CREATE OR REPLACE FUNCTION public.criar_fases_cliente(p_cliente_id uuid, p_plataforma text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Fase 0 sempre única (compartilhada)
  INSERT INTO app_fases (cliente_id, numero, nome, plataforma, status, sla_horas, duracao_dias_estimada)
  VALUES (p_cliente_id, 0, 'Pré-Requisitos', 'compartilhada', 'em_andamento', 48, 2);

  -- Fases 1-6: duplicar por plataforma quando "ambos"
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

  -- Checklist Fase 0 (compartilhada) — apenas 4 itens essenciais
  INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
    (p_cliente_id, 0, 'Solicitei o número DUNS da minha empresa', 'Acesse https://www.dnb.com/de-de/upik-en.html', 'cliente', 'link', 1, 'compartilhada'),
    (p_cliente_id, 0, 'Confirmei que meu CNPJ é ME ou LTDA', 'CNPJs MEI não são aceitos pela Apple.', 'cliente', 'check', 2, 'compartilhada'),
    (p_cliente_id, 0, 'Tenho um e-mail corporativo', 'email@suaempresa.com.br', 'cliente', 'check', 3, 'compartilhada'),
    (p_cliente_id, 0, 'Meu site está publicado com domínio próprio', 'Domínio próprio.', 'cliente', 'check', 4, 'compartilhada');

  -- Checklist Fase 1 por plataforma
  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 1, 'Criei a conta no Google Play Console', 'Acesse https://play.google.com/console/signup. Taxa: US$ 25.', 'cliente', 'link', 1, 'google'),
      (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Google)', 'No Google Play Console → Usuários e permissões.', 'cliente', 'check', 2, 'google'),
      (p_cliente_id, 1, 'Documentação verificada pelo analista (Google)', 'Analista confirma configuração correta.', 'analista', 'check', 3, 'google');
  END IF;
  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 1, 'Criei a conta no Apple Developer Program', 'Acesse https://developer.apple.com/account. Taxa: US$ 99/ano.', 'cliente', 'link', 1, 'apple'),
      (p_cliente_id, 1, 'Adicionei apps@membros.app.br como admin (Apple)', 'No App Store Connect → Usuários e acessos.', 'cliente', 'check', 2, 'apple'),
      (p_cliente_id, 1, 'Documentação verificada pelo analista (Apple)', 'Analista confirma configuração correta.', 'analista', 'check', 3, 'apple');
  END IF;

  -- Checklist Fase 3 por plataforma
  IF p_plataforma = 'ambos' OR p_plataforma = 'google' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 3, 'Formulário do aplicativo (Google)', 'Informações para Google Play.', 'cliente', 'form', 1, 'google'),
      (p_cliente_id, 3, 'Desenvolvimento e Submissão Google Play', 'Equipe submete na Google Play.', 'analista', 'check', 2, 'google');
  END IF;
  IF p_plataforma = 'ambos' OR p_plataforma = 'apple' THEN
    INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma) VALUES
      (p_cliente_id, 3, 'Formulário do aplicativo (Apple)', 'Informações para App Store.', 'cliente', 'form', 1, 'apple'),
      (p_cliente_id, 3, 'Desenvolvimento e Submissão App Store', 'Equipe submete na App Store.', 'analista', 'check', 2, 'apple');
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

  INSERT INTO app_prerequisitos (cliente_id) VALUES (p_cliente_id);
  INSERT INTO app_formulario (cliente_id) VALUES (p_cliente_id);
END;
$function$;

-- 3) Confirm recalcular_progresso_fase has correct logic (already correct from previous migration, but re-create to be safe)
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

  SELECT plataforma INTO fase_plataforma
  FROM app_fases
  WHERE cliente_id = NEW.cliente_id AND numero = NEW.fase_numero
    AND (plataforma = item_plataforma OR plataforma = 'compartilhada')
  LIMIT 1;

  IF fase_plataforma IS NULL THEN
    fase_plataforma := 'compartilhada';
  END IF;

  -- For phase 3: consider ALL items (client + analyst + designer)
  -- For all other phases: consider only CLIENT items for progression
  IF NEW.fase_numero = 3 THEN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE feito = TRUE)
    INTO total_items, items_feitos
    FROM app_checklist_items
    WHERE cliente_id = NEW.cliente_id 
      AND fase_numero = NEW.fase_numero
      AND (plataforma = item_plataforma OR plataforma = 'compartilhada');
  ELSE
    SELECT COUNT(*), COUNT(*) FILTER (WHERE feito = TRUE)
    INTO total_items, items_feitos
    FROM app_checklist_items
    WHERE cliente_id = NEW.cliente_id 
      AND fase_numero = NEW.fase_numero
      AND ator = 'cliente'
      AND (plataforma = item_plataforma OR plataforma = 'compartilhada');
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
    AND plataforma = fase_plataforma;

  IF todos_feitos THEN
    IF NEW.fase_numero = 0 THEN
      UPDATE app_fases SET
        status = 'em_andamento',
        data_inicio = NOW(),
        sla_vencimento = CASE WHEN sla_horas IS NOT NULL THEN NOW() + (sla_horas || ' hours')::INTERVAL ELSE NULL END
      WHERE cliente_id = NEW.cliente_id AND numero = 1 AND status = 'bloqueada';

    ELSIF NEW.fase_numero BETWEEN 1 AND 5 THEN
      UPDATE app_fases SET
        status = 'em_andamento',
        data_inicio = NOW(),
        sla_vencimento = CASE WHEN sla_horas IS NOT NULL THEN NOW() + (sla_horas || ' hours')::INTERVAL ELSE NULL END
      WHERE cliente_id = NEW.cliente_id 
        AND numero = NEW.fase_numero + 1 
        AND plataforma = fase_plataforma
        AND status = 'bloqueada';

      IF NEW.fase_numero = 5 THEN
        SELECT COUNT(*) INTO existing_publish_item
        FROM app_checklist_items
        WHERE cliente_id = NEW.cliente_id AND fase_numero = 6 AND plataforma = fase_plataforma;
        
        IF existing_publish_item = 0 THEN
          INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma)
          VALUES (
            NEW.cliente_id, 6, 
            'Publicar na loja (' || CASE WHEN fase_plataforma = 'google' THEN 'Google Play' ELSE 'App Store' END || ')', 
            'Publicar o aplicativo na loja.',
            'analista', 'check', 1, fase_plataforma
          );
        END IF;

        INSERT INTO app_notificacoes (cliente_id, tipo, canal, destinatario, titulo, mensagem, agendado_para)
        VALUES (
          NEW.cliente_id, 'publicacao_pendente', 'portal', 'analista',
          '🚀 App aprovado — publicar na ' || CASE WHEN fase_plataforma = 'google' THEN 'Google Play' ELSE 'App Store' END,
          'Cliente aprovou o app de teste. Publique na loja.',
          NOW()
        );
      END IF;
    END IF;

    INSERT INTO app_conversas (cliente_id, fase_numero, autor, tipo, mensagem)
    VALUES (
      NEW.cliente_id, NEW.fase_numero, 'Sistema', 'sistema',
      '✅ Fase ' || NEW.fase_numero || ' (' || fase_plataforma || ') concluída em ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI')
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
      7
    ),
    ultima_acao_cliente = CASE WHEN NEW.feito THEN NOW() ELSE ultima_acao_cliente END
  WHERE id = NEW.cliente_id;

  IF NOT EXISTS (
    SELECT 1 FROM app_fases 
    WHERE cliente_id = NEW.cliente_id AND numero = 6 AND status != 'concluida'
  ) AND EXISTS (
    SELECT 1 FROM app_fases WHERE cliente_id = NEW.cliente_id AND numero = 6
  ) THEN
    UPDATE app_clientes SET status = 'concluido' WHERE id = NEW.cliente_id;
  END IF;

  -- Overall progress: count ALL items across ALL phases
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

-- 4) Force recalculation for all clients in fase 0 by touching one item per client
UPDATE app_checklist_items 
SET feito = feito 
WHERE fase_numero = 0 
AND id IN (
  SELECT DISTINCT ON (cliente_id) id 
  FROM app_checklist_items 
  WHERE fase_numero = 0
);
