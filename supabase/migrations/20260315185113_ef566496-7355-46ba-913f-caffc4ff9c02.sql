
CREATE TABLE public.cliente_engajamento_produto (
  id_curseduca TEXT NOT NULL PRIMARY KEY,
  nome TEXT,
  email TEXT,
  cs_atual TEXT,
  plano TEXT,
  status_financeiro TEXT,
  status_curseduca TEXT,
  indice_fidelidade DOUBLE PRECISION,
  data_criacao TIMESTAMPTZ,
  data_ultimo_login DATE,
  recorrencia_acesso TEXT,
  tempo_medio_uso_web_minutos INTEGER,
  membros_mes_atual INTEGER,
  membros_mes_m1 INTEGER,
  membros_mes_m2 INTEGER,
  membros_mes_m3 INTEGER,
  membros_mes_m4 INTEGER,
  membros_ativos_total INTEGER,
  variacao_m0_vs_m1 DOUBLE PRECISION,
  variacao_m1_vs_m2 DOUBLE PRECISION,
  variacao_m2_vs_m3 DOUBLE PRECISION,
  variacao_m3_vs_m4 DOUBLE PRECISION,
  taxa_retencao_cliente DOUBLE PRECISION,
  taxa_retencao_membro DOUBLE PRECISION,
  taxa_ativacao_cliente DOUBLE PRECISION,
  taxa_ativacao_membro DOUBLE PRECISION,
  taxa_adocao_app DOUBLE PRECISION,
  dias_desde_ultimo_login INTEGER,
  dias_sem_interacao INTEGER,
  alerta_inatividade BOOLEAN,
  player_bandwidth_hired BIGINT,
  player_bandwidth_used BIGINT,
  player_bandwidth_pct_uso DOUBLE PRECISION,
  player_storage_hired BIGINT,
  player_storage_used BIGINT,
  player_storage_pct_uso DOUBLE PRECISION,
  ai_tokens_hired BIGINT,
  ai_tokens_used BIGINT,
  ai_tokens_pct_uso DOUBLE PRECISION,
  certificates_mec_hired INTEGER,
  certificates_mec_used INTEGER,
  certificates_mec_pct_uso DOUBLE PRECISION,
  cobranca_automatica_banda_excedente BOOLEAN,
  cobranca_automatica_token_excedente BOOLEAN,
  gatilho_upgrade_100alunos BOOLEAN,
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cliente_engajamento_produto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cliente_engajamento_produto"
  ON public.cliente_engajamento_produto FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cliente_engajamento_produto"
  ON public.cliente_engajamento_produto FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update cliente_engajamento_produto"
  ON public.cliente_engajamento_produto FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete cliente_engajamento_produto"
  ON public.cliente_engajamento_produto FOR DELETE TO authenticated USING (true);
