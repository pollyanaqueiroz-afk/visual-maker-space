
ALTER TABLE app_checklist_items ADD COLUMN IF NOT EXISTS responsavel TEXT;
ALTER TABLE app_checklist_items ADD COLUMN IF NOT EXISTS sla_horas INTEGER;
ALTER TABLE app_checklist_items ADD COLUMN IF NOT EXISTS sla_vencimento TIMESTAMPTZ;

-- Set default SLA of 24h for analyst/designer tasks
UPDATE app_checklist_items 
SET sla_horas = 24 
WHERE ator IN ('analista', 'designer') AND sla_horas IS NULL;

-- For existing uncompleted tasks, calculate deadline from created_at
UPDATE app_checklist_items 
SET sla_vencimento = created_at + (COALESCE(sla_horas, 24) || ' hours')::INTERVAL
WHERE ator IN ('analista', 'designer') AND feito = false AND sla_vencimento IS NULL;
