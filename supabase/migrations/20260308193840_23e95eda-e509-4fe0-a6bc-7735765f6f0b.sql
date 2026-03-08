
-- Add lida column to app_notificacoes
ALTER TABLE app_notificacoes ADD COLUMN IF NOT EXISTS lida BOOLEAN DEFAULT false;

-- Create verificar_prazos_lojas function
CREATE OR REPLACE FUNCTION public.verificar_prazos_lojas()
RETURNS void LANGUAGE plpgsql AS $function$
DECLARE
  fase_record RECORD;
  dias_uteis_limite INTEGER;
  data_limite TIMESTAMPTZ;
  dias_corridos INTEGER;
  cliente_record RECORD;
  alerta_exists BOOLEAN;
BEGIN
  FOR fase_record IN
    SELECT f.id, f.cliente_id, f.numero, f.plataforma, f.data_inicio, f.status
    FROM app_fases f
    WHERE f.numero IN (2, 4)
    AND f.status = 'em_andamento'
    AND f.data_inicio IS NOT NULL
  LOOP
    IF fase_record.numero = 2 AND fase_record.plataforma = 'google' THEN dias_uteis_limite := 3;
    ELSIF fase_record.numero = 2 AND fase_record.plataforma = 'apple' THEN dias_uteis_limite := 7;
    ELSIF fase_record.numero = 4 AND fase_record.plataforma = 'google' THEN dias_uteis_limite := 4;
    ELSIF fase_record.numero = 4 AND fase_record.plataforma = 'apple' THEN dias_uteis_limite := 10;
    ELSE CONTINUE;
    END IF;

    data_limite := fase_record.data_inicio;
    dias_corridos := 0;
    WHILE dias_corridos < dias_uteis_limite LOOP
      data_limite := data_limite + INTERVAL '1 day';
      IF EXTRACT(DOW FROM data_limite) NOT IN (0, 6) THEN
        dias_corridos := dias_corridos + 1;
      END IF;
    END LOOP;

    IF NOW() > data_limite THEN
      SELECT EXISTS (
        SELECT 1 FROM app_checklist_items
        WHERE cliente_id = fase_record.cliente_id
        AND fase_numero = fase_record.numero
        AND plataforma = fase_record.plataforma
        AND tipo = 'alerta_prazo'
        AND feito = false
      ) INTO alerta_exists;

      IF NOT alerta_exists THEN
        SELECT nome, empresa, email INTO cliente_record
        FROM app_clientes WHERE id = fase_record.cliente_id;

        INSERT INTO app_checklist_items (
          cliente_id, fase_numero, texto, descricao, ator, tipo, ordem, plataforma, obrigatorio
        ) VALUES (
          fase_record.cliente_id, fase_record.numero,
          '🚨 PRAZO EXCEDIDO: ' || 
            CASE WHEN fase_record.numero = 2 THEN 'Validação' ELSE 'Aprovação' END || ' ' ||
            CASE WHEN fase_record.plataforma = 'google' THEN 'Google Play' ELSE 'App Store' END || ' — Verificar com a loja',
          'O prazo de ' || dias_uteis_limite || ' dias úteis expirou em ' || TO_CHAR(data_limite, 'DD/MM/YYYY') || '. Entrar em contato com a loja.',
          'analista', 'alerta_prazo', 0, fase_record.plataforma, true
        );

        INSERT INTO app_notificacoes (cliente_id, tipo, canal, destinatario, titulo, mensagem, agendado_para)
        VALUES (
          fase_record.cliente_id, 'prazo_loja_excedido', 'portal', 'analista',
          '🚨 Prazo excedido: ' || CASE WHEN fase_record.numero = 2 THEN 'Validação' ELSE 'Aprovação' END || ' ' ||
            CASE WHEN fase_record.plataforma = 'google' THEN 'Google Play' ELSE 'App Store' END,
          cliente_record.nome || ' (' || cliente_record.empresa || ') — prazo de ' || dias_uteis_limite || ' dias úteis expirou.',
          NOW()
        );

        INSERT INTO app_notificacoes (cliente_id, tipo, canal, destinatario, titulo, mensagem, agendado_para)
        VALUES (
          fase_record.cliente_id, 'prazo_loja_excedido', 'portal', 'gerente',
          '🚨 Prazo excedido: ' || CASE WHEN fase_record.numero = 2 THEN 'Validação' ELSE 'Aprovação' END || ' ' ||
            CASE WHEN fase_record.plataforma = 'google' THEN 'Google Play' ELSE 'App Store' END,
          cliente_record.nome || ' (' || cliente_record.empresa || ') — prazo de ' || dias_uteis_limite || ' dias úteis expirou.',
          NOW()
        );

        INSERT INTO app_notificacoes (cliente_id, tipo, canal, destinatario, titulo, mensagem, agendado_para)
        VALUES 
        (
          fase_record.cliente_id, 'prazo_loja_excedido', 'email', 'analista',
          '🚨 Prazo excedido — ' || cliente_record.nome,
          'O prazo de ' || dias_uteis_limite || ' dias úteis para ' ||
            CASE WHEN fase_record.numero = 2 THEN 'validação' ELSE 'aprovação' END ||
            ' na ' || CASE WHEN fase_record.plataforma = 'google' THEN 'Google Play' ELSE 'App Store' END ||
            ' expirou para ' || cliente_record.nome || ' (' || cliente_record.empresa || ').',
          NOW()
        ),
        (
          fase_record.cliente_id, 'prazo_loja_excedido', 'email', 'gerente',
          '🚨 Prazo excedido — ' || cliente_record.nome,
          'O prazo de ' || dias_uteis_limite || ' dias úteis para ' ||
            CASE WHEN fase_record.numero = 2 THEN 'validação' ELSE 'aprovação' END ||
            ' na ' || CASE WHEN fase_record.plataforma = 'google' THEN 'Google Play' ELSE 'App Store' END ||
            ' expirou para ' || cliente_record.nome || ' (' || cliente_record.empresa || ').',
          NOW()
        );

        UPDATE app_fases SET status = 'atrasada', sla_violado = true WHERE id = fase_record.id;
      END IF;
    END IF;
  END LOOP;
END;
$function$;

-- Also add the call inside recalcular_progresso_fase at the end
-- We add it as a separate trigger-based approach
CREATE OR REPLACE FUNCTION public.check_prazos_on_fase_change()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.fase_numero IN (2, 4) THEN
    PERFORM verificar_prazos_lojas();
  END IF;
  RETURN NEW;
END;
$function$;
