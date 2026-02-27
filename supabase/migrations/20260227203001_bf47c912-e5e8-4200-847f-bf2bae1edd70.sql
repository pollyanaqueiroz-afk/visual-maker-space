
-- Drop columns that won't be used anymore
ALTER TABLE public.clients DROP COLUMN IF EXISTS client_status;
ALTER TABLE public.clients DROP COLUMN IF EXISTS loyalty_index;
ALTER TABLE public.clients DROP COLUMN IF EXISTS cs_user_id;
ALTER TABLE public.clients DROP COLUMN IF EXISTS plan;
ALTER TABLE public.clients DROP COLUMN IF EXISTS monthly_value;

-- Rename existing columns to match new schema
ALTER TABLE public.clients RENAME COLUMN telefone_do_cliente TO telefone_do_cliente_old;
ALTER TABLE public.clients RENAME COLUMN portal_do_cliente TO portal_do_cliente_old;
ALTER TABLE public.clients RENAME COLUMN forma_de_pagamento TO forma_de_pagamento_old;
ALTER TABLE public.clients RENAME COLUMN data_da_primeira_parcela_vencida TO data_da_primeira_parcela_vencida_old;
ALTER TABLE public.clients RENAME COLUMN tipo_de_cs TO tipo_de_cs_old;

-- Add all new columns
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS id_curseduca text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email_do_cliente text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS telefone_do_cliente text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS portal_do_cliente text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status_financeiro text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS forma_de_pagamento text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS valor_mensal text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS valor_total_devido text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_da_primeira_parcela_vencida text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS plano_detalhado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS plano_contratado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tipo_de_cs text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nome_antigo text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email_do_cs_antigo text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nome_do_cs_atual text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email_do_cs_atual text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS etapa_antiga_sensedata text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS origem_do_dado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nome_da_plataforma text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_do_dado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_do_processamento_do_dado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS banda_contratada text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS banda_utilizada text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS armazenamento_contratado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS armazenamento_utilizado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS token_de_ia_contratado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS token_de_ia_utilizado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS certificado_mec_contratado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS certificado_mec_utilizado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_da_primeira_compra text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_da_10_compra text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_da_50_compra text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_da_100_compra text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_da_200_compra text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_do_primeiro_conteudo_finalizado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_do_10_conteudo_finalizado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_do_50_conteudo_finalizado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_do_100_conteudo_finalizado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_do_200_conteudo_finalizado text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nome_do_closer text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email_do_closer text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_do_fechamento_do_contrato text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS metrica_de_sucesso_acordada_na_venda text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS desconto_concedido text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS data_do_ultimo_login text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tempo_medio_de_uso_em_min text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS membros_do_mes_atual text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS variacao_de_quantidade_de_membros_por_mes text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS dias_desde_o_ultimo_login text;

-- Migrate old data to new columns
UPDATE public.clients SET 
  telefone_do_cliente = telefone_do_cliente_old,
  portal_do_cliente = portal_do_cliente_old,
  forma_de_pagamento = forma_de_pagamento_old,
  data_da_primeira_parcela_vencida = data_da_primeira_parcela_vencida_old,
  tipo_de_cs = tipo_de_cs_old;

-- Drop old renamed columns
ALTER TABLE public.clients DROP COLUMN IF EXISTS telefone_do_cliente_old;
ALTER TABLE public.clients DROP COLUMN IF EXISTS portal_do_cliente_old;
ALTER TABLE public.clients DROP COLUMN IF EXISTS forma_de_pagamento_old;
ALTER TABLE public.clients DROP COLUMN IF EXISTS data_da_primeira_parcela_vencida_old;
ALTER TABLE public.clients DROP COLUMN IF EXISTS tipo_de_cs_old;

-- Also update the sync trigger to not reference removed columns
CREATE OR REPLACE FUNCTION public.sync_meeting_loyalty_to_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.client_url IS NOT NULL THEN
    INSERT INTO public.clients (client_url, client_name)
    VALUES (NEW.client_url, NEW.client_name)
    ON CONFLICT (client_url) DO UPDATE SET
      client_name = COALESCE(EXCLUDED.client_name, clients.client_name),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$;
