
-- Fix existing clients that are published but not at 100%
UPDATE app_clientes SET porcentagem_geral = 100 WHERE fase_atual >= 6;

-- Update the trigger to force 100% when phase 6 completes
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
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE feito = TRUE)
  INTO total_items, items_feitos
  FROM app_checklist_items
  WHERE cliente_id = NEW.cliente_id AND fase_numero = NEW.fase_numero;
  
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

    IF NEW.fase_numero = 5 THEN
      SELECT COUNT(*) INTO existing_publish_item
      FROM app_checklist_items
      WHERE cliente_id = NEW.cliente_id AND fase_numero = 6;
      
      IF existing_publish_item = 0 THEN
        INSERT INTO app_checklist_items (cliente_id, fase_numero, texto, descricao, ator, tipo, ordem)
        VALUES (
          NEW.cliente_id, 6, 
          'Publicar na loja', 
          'O analista irá publicar o aplicativo nas lojas oficiais.',
          'analista', 'check', 1
        );
      END IF;

      INSERT INTO app_notificacoes (cliente_id, tipo, canal, destinatario, titulo, mensagem, agendado_para)
      VALUES (
        NEW.cliente_id,
        'publicacao_pendente',
        'portal',
        'analista',
        '🚀 App aprovado pelo cliente — publicar na loja',
        'O cliente aprovou o app de teste. Publique o aplicativo nas lojas.',
        NOW()
      );
    END IF;
  END IF;
  
  -- Get current fase_atual
  SELECT fase_atual INTO current_fase FROM app_clientes WHERE id = NEW.cliente_id;
  
  -- If published (fase >= 6), force 100%
  IF current_fase >= 6 THEN
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
