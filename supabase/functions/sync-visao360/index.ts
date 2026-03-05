import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_URL = "https://us-central1-curseduca-inc-ia.cloudfunctions.net/hub-clientes";
const PER_PAGE = 200;

function mapRecord(r: any): Record<string, string | null> {
  const s = (v: any) => (v == null ? null : String(v));
  return {
    id_curseduca: s(r.id_curseduca),
    client_url: s(r.url_plataforma),
    client_name: s(r.cliente_nome),
    email_do_cliente: s(r.cliente_email),
    status_financeiro: s(r.status_financeiro_inadimplencia),
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
    membros_do_mes_atual: s(r.numero_alunos),
    variacao_de_quantidade_de_membros_por_mes: s(r.variacao_vs_mes_anterior),
    dias_desde_o_ultimo_login: s(r.dias_desde_ultimo_login),
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

    const basicAuth = btoa(`${apiUser}:${apiPass}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch first page to get total count
    const firstRes = await fetch(`${API_URL}?page=1&per_page=${PER_PAGE}`, {
      headers: { Authorization: `Basic ${basicAuth}` },
    });

    if (!firstRes.ok) {
      const errText = await firstRes.text();
      throw new Error(`API retornou ${firstRes.status}: ${errText}`);
    }

    const firstPage = await firstRes.json();
    const totalPages = firstPage.total_pages || 1;
    const totalRecords = firstPage.total || 0;

    console.log(`Visão 360: ${totalRecords} registros em ${totalPages} páginas`);

    // Collect all records
    let allRecords: any[] = firstPage.data || [];

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const res = await fetch(`${API_URL}?page=${page}&per_page=${PER_PAGE}`, {
        headers: { Authorization: `Basic ${basicAuth}` },
      });
      if (!res.ok) {
        console.error(`Erro na página ${page}: ${res.status}`);
        continue;
      }
      const pageData = await res.json();
      allRecords = allRecords.concat(pageData.data || []);
    }

    console.log(`Total de registros obtidos da API: ${allRecords.length}`);

    // 2. Process records using upsert with id_curseduca as conflict key
    let updated = 0;
    let inserted = 0;
    let errors = 0;

    const BATCH_SIZE = 50;

    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      const rows = batch
        .map((raw: any) => mapRecord(raw))
        .filter((r: any) => r.id_curseduca && r.client_url);

      if (rows.length === 0) continue;

      const { data, error } = await supabase
        .from("clients")
        .upsert(rows, { onConflict: "id_curseduca", ignoreDuplicates: false })
        .select("id");

      if (error) {
        console.error(`Erro no batch ${i}:`, error.message);
        // Try one by one
        for (const row of rows) {
          const { error: singleErr } = await supabase
            .from("clients")
            .upsert(row, { onConflict: "id_curseduca", ignoreDuplicates: false });
          if (singleErr) {
            console.error(`Erro ${row.id_curseduca}:`, singleErr.message);
            errors++;
          } else {
            updated++;
          }
        }
      } else {
        updated += rows.length;
      }
    }

    const result = {
      success: true,
      total_api: allRecords.length,
      synced: updated,
      errors,
    };

    console.log("Sync completo:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
