
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

  -- Overall progress: count ALL items across ALL phases (real project progress)
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
