
-- Drop FK constraints first
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_kanban_column_id_fkey;

-- Drop all unnecessary columns, keep: id, id_curseduca, created_at, updated_at
ALTER TABLE public.clients
  DROP COLUMN IF EXISTS client_url,
  DROP COLUMN IF EXISTS client_name,
  DROP COLUMN IF EXISTS email_do_cliente,
  DROP COLUMN IF EXISTS email_do_cliente_2,
  DROP COLUMN IF EXISTS telefone_do_cliente,
  DROP COLUMN IF EXISTS portal_do_cliente,
  DROP COLUMN IF EXISTS status_financeiro,
  DROP COLUMN IF EXISTS forma_de_pagamento,
  DROP COLUMN IF EXISTS valor_mensal,
  DROP COLUMN IF EXISTS valor_total_devido,
  DROP COLUMN IF EXISTS data_da_primeira_parcela_vencida,
  DROP COLUMN IF EXISTS plano_detalhado,
  DROP COLUMN IF EXISTS plano_contratado,
  DROP COLUMN IF EXISTS tipo_de_cs,
  DROP COLUMN IF EXISTS nome_antigo,
  DROP COLUMN IF EXISTS email_do_cs_antigo,
  DROP COLUMN IF EXISTS nome_do_cs_atual,
  DROP COLUMN IF EXISTS email_do_cs_atual,
  DROP COLUMN IF EXISTS e_mail_do_cs_antigo,
  DROP COLUMN IF EXISTS e_mail_do_cs_atual,
  DROP COLUMN IF EXISTS e_mail_do_closer,
  DROP COLUMN IF EXISTS etapa_antiga_sensedata,
  DROP COLUMN IF EXISTS origem_do_dado,
  DROP COLUMN IF EXISTS nome_da_plataforma,
  DROP COLUMN IF EXISTS data_do_dado,
  DROP COLUMN IF EXISTS data_do_processamento_do_dado,
  DROP COLUMN IF EXISTS banda_contratada,
  DROP COLUMN IF EXISTS banda_utilizada,
  DROP COLUMN IF EXISTS armazenamento_contratado,
  DROP COLUMN IF EXISTS armazenamento_utilizado,
  DROP COLUMN IF EXISTS token_de_ia_contratado,
  DROP COLUMN IF EXISTS token_de_ia_utilizado,
  DROP COLUMN IF EXISTS certificado_mec_contratado,
  DROP COLUMN IF EXISTS certificado_mec_utilizado,
  DROP COLUMN IF EXISTS data_da_primeira_compra,
  DROP COLUMN IF EXISTS data_da_10_compra,
  DROP COLUMN IF EXISTS data_da_50_compra,
  DROP COLUMN IF EXISTS data_da_100_compra,
  DROP COLUMN IF EXISTS data_da_200_compra,
  DROP COLUMN IF EXISTS data_do_primeiro_conteudo_finalizado,
  DROP COLUMN IF EXISTS data_do_10_conteudo_finalizado,
  DROP COLUMN IF EXISTS data_do_50_conteudo_finalizado,
  DROP COLUMN IF EXISTS data_do_100_conteudo_finalizado,
  DROP COLUMN IF EXISTS data_do_200_conteudo_finalizado,
  DROP COLUMN IF EXISTS nome_do_closer,
  DROP COLUMN IF EXISTS email_do_closer,
  DROP COLUMN IF EXISTS data_do_fechamento_do_contrato,
  DROP COLUMN IF EXISTS metrica_de_sucesso_acordada_na_venda,
  DROP COLUMN IF EXISTS desconto_concedido,
  DROP COLUMN IF EXISTS data_do_ultimo_login,
  DROP COLUMN IF EXISTS tempo_medio_de_uso_em_min,
  DROP COLUMN IF EXISTS membros_do_mes_atual,
  DROP COLUMN IF EXISTS variacao_de_quantidade_de_membros_por_mes,
  DROP COLUMN IF EXISTS dias_desde_o_ultimo_login,
  DROP COLUMN IF EXISTS kanban_column_id;

-- Add new simplified columns
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS cliente TEXT,
  ADD COLUMN IF NOT EXISTS cs_atual TEXT,
  ADD COLUMN IF NOT EXISTS cs_anterior TEXT,
  ADD COLUMN IF NOT EXISTS fatura TEXT,
  ADD COLUMN IF NOT EXISTS plano TEXT,
  ADD COLUMN IF NOT EXISTS data_da_carga TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Make id_curseduca unique for upsert
CREATE UNIQUE INDEX IF NOT EXISTS clients_id_curseduca_unique ON public.clients (id_curseduca);
