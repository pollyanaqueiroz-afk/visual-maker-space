
-- Create client_field_definitions table for dynamic field schema
CREATE TABLE public.client_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  db_key text NOT NULL UNIQUE,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'texto',
  enum_options text[] DEFAULT '{}',
  is_required boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_field_definitions ENABLE ROW LEVEL SECURITY;

-- Admins can manage field definitions
CREATE POLICY "Admins can manage field definitions"
ON public.client_field_definitions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read field definitions
CREATE POLICY "Authenticated users can read field definitions"
ON public.client_field_definitions
FOR SELECT
TO authenticated
USING (true);

-- Seed existing columns as field definitions
INSERT INTO public.client_field_definitions (db_key, label, field_type, sort_order, enum_options) VALUES
  ('id_curseduca', 'ID Curseduca', 'texto', 1, '{}'),
  ('client_url', 'URL do Cliente', 'url', 2, '{}'),
  ('client_name', 'Nome do Cliente', 'texto', 3, '{}'),
  ('email_do_cliente', 'E-mail do Cliente', 'email', 4, '{}'),
  ('telefone_do_cliente', 'Telefone do Cliente', 'texto', 5, '{}'),
  ('portal_do_cliente', 'Portal do Cliente', 'enum', 6, ARRAY['Ativo', 'Inativo']),
  ('status_financeiro', 'Status Financeiro', 'enum', 7, ARRAY['Adimplente', 'Inadimplente']),
  ('forma_de_pagamento', 'Forma de Pagamento', 'enum', 8, '{}'),
  ('valor_mensal', 'Valor Mensal', 'moeda', 9, '{}'),
  ('valor_total_devido', 'Valor Total Devido', 'texto', 10, '{}'),
  ('data_da_primeira_parcela_vencida', 'Data da Primeira Parcela Vencida', 'data', 11, '{}'),
  ('plano_detalhado', 'Plano Detalhado', 'texto', 12, '{}'),
  ('plano_contratado', 'Plano Contratado', 'enum', 13, ARRAY['Scale', 'Evolution', 'Curseduca', 'Engage', 'Evolution APP']),
  ('tipo_de_cs', 'Tipo de CS', 'enum', 14, ARRAY['CS', 'Administrador']),
  ('nome_antigo', 'Nome Antigo', 'texto', 15, '{}'),
  ('email_do_cs_antigo', 'E-mail do CS Antigo', 'email', 16, '{}'),
  ('nome_do_cs_atual', 'Nome do CS Atual', 'texto', 17, '{}'),
  ('email_do_cs_atual', 'E-mail do CS Atual', 'email', 18, '{}'),
  ('etapa_antiga_sensedata', 'Etapa Antiga Sensedata', 'enum', 19, ARRAY['MONITORAMENTO', '+7 DIAS SEM RETORNO', 'ENTRADA', 'RISCO DE CHURN', 'CANCELADOS', 'ENGAJADO/ATIVO', 'INADIMPLENTES', 'IMPLANTAÇÃO', 'ADAPTAÇÃO']),
  ('origem_do_dado', 'Origem do Dado', 'enum', 20, ARRAY['Base Consolidada Manual', 'Somente no Sense']),
  ('nome_da_plataforma', 'Nome da Plataforma', 'texto', 21, '{}'),
  ('data_do_dado', 'Data do Dado', 'data', 22, '{}'),
  ('data_do_processamento_do_dado', 'Data do Processamento do Dado', 'data', 23, '{}'),
  ('banda_contratada', 'Banda Contratada', 'numero', 24, '{}'),
  ('banda_utilizada', 'Banda Utilizada', 'numero', 25, '{}'),
  ('armazenamento_contratado', 'Armazenamento Contratado', 'numero', 26, '{}'),
  ('armazenamento_utilizado', 'Armazenamento Utilizado', 'numero', 27, '{}'),
  ('token_de_ia_contratado', 'Token de IA Contratado', 'numero', 28, '{}'),
  ('token_de_ia_utilizado', 'Token de IA Utilizado', 'numero', 29, '{}'),
  ('certificado_mec_contratado', 'Certificado MEC Contratado', 'numero', 30, '{}'),
  ('certificado_mec_utilizado', 'Certificado MEC Utilizado', 'numero', 31, '{}'),
  ('data_da_primeira_compra', 'Data da Primeira Compra', 'data', 32, '{}'),
  ('data_da_10_compra', 'Data da 10ª Compra', 'data', 33, '{}'),
  ('data_da_50_compra', 'Data da 50ª Compra', 'data', 34, '{}'),
  ('data_da_100_compra', 'Data da 100ª Compra', 'data', 35, '{}'),
  ('data_da_200_compra', 'Data da 200ª Compra', 'data', 36, '{}'),
  ('data_do_primeiro_conteudo_finalizado', 'Data do 1º Conteúdo Finalizado', 'data', 37, '{}'),
  ('data_do_10_conteudo_finalizado', 'Data do 10º Conteúdo Finalizado', 'data', 38, '{}'),
  ('data_do_50_conteudo_finalizado', 'Data do 50º Conteúdo Finalizado', 'data', 39, '{}'),
  ('data_do_100_conteudo_finalizado', 'Data do 100º Conteúdo Finalizado', 'data', 40, '{}'),
  ('data_do_200_conteudo_finalizado', 'Data do 200º Conteúdo Finalizado', 'data', 41, '{}'),
  ('nome_do_closer', 'Nome do Closer', 'texto', 42, '{}'),
  ('email_do_closer', 'E-mail do Closer', 'email', 43, '{}'),
  ('data_do_fechamento_do_contrato', 'Data do Fechamento do Contrato', 'data', 44, '{}'),
  ('metrica_de_sucesso_acordada_na_venda', 'Métrica de Sucesso Acordada na Venda', 'texto', 45, '{}'),
  ('desconto_concedido', 'Desconto Concedido', 'texto', 46, '{}'),
  ('data_do_ultimo_login', 'Data do Último Login', 'data', 47, '{}'),
  ('tempo_medio_de_uso_em_min', 'Tempo Médio de Uso (min)', 'numero', 48, '{}'),
  ('membros_do_mes_atual', 'Membros do Mês Atual', 'numero', 49, '{}'),
  ('variacao_de_quantidade_de_membros_por_mes', 'Variação de Membros por Mês', 'numero', 50, '{}'),
  ('dias_desde_o_ultimo_login', 'Dias Desde o Último Login', 'numero', 51, '{}'),
  ('email_do_cliente_2', 'E-mail do Cliente 2', 'email', 52, '{}');
