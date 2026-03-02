UPDATE app_clientes c SET
  porcentagem_geral = COALESCE((
    SELECT ROUND((COUNT(*) FILTER (WHERE feito = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) * 100)
    FROM app_checklist_items
    WHERE cliente_id = c.id
  ), 0);