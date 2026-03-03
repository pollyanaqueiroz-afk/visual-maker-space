const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_URL = "https://us-central1-curseduca-inc-ia.cloudfunctions.net/visao-360-api";

function mapRecord(r: any): Record<string, any> {
  const s = (v: any) => (v == null ? null : String(v));
  return {
    id: null,
    id_curseduca: s(r.id_curseduca),
    client_url: s(r.url_plataforma),
    client_name: s(r.cliente_nome),
    email_do_cliente: s(r.cliente_email),
    status_financeiro: s(r.status_financeiro),
    valor_mensal: s(r.fatura_total),
    plano_contratado: s(r.plano_base_consolidada),
    plano_detalhado: s(r.plano_nome_formatado),
    nome_do_cs_atual: s(r.cs_nome),
    email_do_cs_atual: s(r.cs_email),
    etapa_antiga_sensedata: s(r.etapa_do_cs),
    origem_do_dado: s(r.origem),
    nome_da_plataforma: s(r.plataforma_nome),
    data_do_dado: s(r.metricas_gerado_em),
    data_do_processamento_do_dado: s(r.metricas_processado_em),
    banda_contratada: s(r.player_banda_contratada),
    banda_utilizada: s(r.player_banda_utilizada),
    armazenamento_contratado: s(r.player_armazenamento_contratado),
    armazenamento_utilizado: s(r.player_armazenamento_utilizado),
    token_de_ia_contratado: s(r.ia_tokens_contratados),
    token_de_ia_utilizado: s(r.ia_tokens_utilizados),
    certificado_mec_contratado: s(r.certificados_mec_contratados),
    certificado_mec_utilizado: s(r.certificados_mec_utilizados),
    data_da_primeira_compra: s(r.compras_data_primeira),
    data_da_10_compra: s(r.compras_data_decima),
    data_da_50_compra: s(r.compras_data_quinquagesima),
    data_da_100_compra: s(r.compras_data_centesima),
    data_da_200_compra: s(r.compras_data_ducentesima),
    data_do_primeiro_conteudo_finalizado: s(r.conteudos_data_primeiro_finalizado),
    data_do_10_conteudo_finalizado: s(r.conteudos_data_decimo_finalizado),
    data_do_50_conteudo_finalizado: s(r.conteudos_data_quinquagesimo_finalizado),
    data_do_100_conteudo_finalizado: s(r.conteudos_data_centesimo_finalizado),
    data_do_200_conteudo_finalizado: s(r.conteudos_data_ducentesimo_finalizado),
    data_do_fechamento_do_contrato: s(r.hubspot_data_contrato),
    metrica_de_sucesso_acordada_na_venda: s(r.hubspot_metrica_sucesso_cliente),
    desconto_concedido: s(r.hubspot_desconto_concedido),
    data_do_ultimo_login: s(r.data_ultimo_login),
    tempo_medio_de_uso_em_min: s(r.tempo_medio_uso_web_minutos),
    membros_do_mes_atual: s(r.membros_mes_atual),
    variacao_de_quantidade_de_membros_por_mes: s(r.variacao_m0_vs_m1),
    dias_desde_o_ultimo_login: s(r.dias_desde_ultimo_login),
    // Columns that don't have API mapping
    created_at: null,
    updated_at: null,
    kanban_column_id: null,
    nome_antigo: null,
    telefone_do_cliente: null,
    email_do_cliente_2: null,
    portal_do_cliente: null,
    forma_de_pagamento: null,
    tipo_de_cs: null,
    nome_do_closer: null,
    email_do_closer: null,
    e_mail_do_closer: null,
    e_mail_do_cs_antigo: null,
    e_mail_do_cs_atual: null,
    email_do_cs_antigo: null,
    valor_total_devido: null,
    data_da_primeira_parcela_vencida: null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiUser = Deno.env.get("VISAO360_API_USER");
    const apiPass = Deno.env.get("VISAO360_API_PASSWORD");
    if (!apiUser || !apiPass) {
      throw new Error("Credenciais da API Visão 360 não configuradas");
    }

    const url = new URL(req.url);
    const idCurseduca = url.searchParams.get("id_curseduca");
    const page = url.searchParams.get("page") || "1";
    const perPage = url.searchParams.get("per_page") || "10";

    const basicAuth = btoa(`${apiUser}:${apiPass}`);

    let apiUrl = `${API_URL}?page=${page}&per_page=${perPage}`;
    if (idCurseduca) {
      apiUrl = `${API_URL}?id_curseduca=${encodeURIComponent(idCurseduca)}`;
    }

    const apiRes = await fetch(apiUrl, {
      headers: { Authorization: `Basic ${basicAuth}` },
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      throw new Error(`API retornou ${apiRes.status}: ${errText}`);
    }

    const apiData = await apiRes.json();
    const mapped = (apiData.data || []).map((r: any) => mapRecord(r));

    return new Response(
      JSON.stringify({
        data: mapped,
        total: apiData.total || 0,
        page: apiData.page || 1,
        per_page: apiData.per_page || 10,
        total_pages: apiData.total_pages || 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Fetch error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
