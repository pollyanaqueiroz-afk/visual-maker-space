import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPECTED_TOKEN = "WxYVWSfUJ3kslYCkqlyo5DMdsQHzBA1guEvgAlF86T4CiMqPmPbrVEemby5udFaq";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Basic\s+/i, "").trim();

    if (token !== EXPECTED_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "50"), 1000);
    const search = url.searchParams.get("search") || "";
    const idCurseduca = url.searchParams.get("id_curseduca") || "";
    const status = url.searchParams.get("status") || "";
    const meioPagamento = url.searchParams.get("meio_de_pagamento") || "";
    const recorrencia = url.searchParams.get("recorrencia_pagamento") || "";
    const tipoProduto = url.searchParams.get("tipo_produto_master") || "";
    const isPlano = url.searchParams.get("is_plano");
    const isUpsell = url.searchParams.get("is_upsell");

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase.from("cliente_financeiro").select("*", { count: "exact" });

    if (search) {
      query = query.or(
        `nome.ilike.%${search}%,email.ilike.%${search}%,id_curseduca.ilike.%${search}%,plano.ilike.%${search}%,nome_plano_master.ilike.%${search}%`
      );
    }
    if (idCurseduca) query = query.eq("id_curseduca", idCurseduca);
    if (status) query = query.eq("status", status);
    if (meioPagamento) query = query.eq("meio_de_pagamento", meioPagamento);
    if (recorrencia) query = query.eq("recorrencia_pagamento", recorrencia);
    if (tipoProduto) query = query.eq("tipo_produto_master", tipoProduto);
    if (isPlano !== null && isPlano !== "") query = query.eq("is_plano", isPlano === "true");
    if (isUpsell !== null && isUpsell !== "") query = query.eq("is_upsell", isUpsell === "true");

    const { data, count, error } = await query
      .range(from, to)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        data: data || [],
        total: count || 0,
        page,
        per_page: perPage,
        total_pages: Math.ceil((count || 0) / perPage),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("list-financeiro-api error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
