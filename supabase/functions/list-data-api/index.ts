import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPECTED_TOKEN = "WxYVWSfUJ3kslYCkqlyo5DMdsQHzBA1guEvgAlF86T4CiMqPmPbrVEemby5udFaq";

// Whitelist of allowed entities
const ALLOWED_ENTITIES: Record<string, { table: string; searchColumns?: string[]; orderBy?: string }> = {
  clients: { table: "clients", searchColumns: ["cliente", "id_curseduca", "cs_atual"], orderBy: "cliente" },
  meetings: { table: "meetings", searchColumns: ["title", "client_name", "client_email"], orderBy: "meeting_date" },
  briefing_requests: { table: "briefing_requests", searchColumns: ["requester_name", "requester_email", "platform_url"], orderBy: "created_at" },
  briefing_images: { table: "briefing_images", searchColumns: ["product_name", "assigned_email"], orderBy: "created_at" },
  briefing_adjustments: { table: "briefing_adjustments", searchColumns: ["client_email", "client_url"], orderBy: "created_at" },
  briefing_deliveries: { table: "briefing_deliveries", searchColumns: ["delivered_by_email"], orderBy: "created_at" },
  briefing_reviews: { table: "briefing_reviews", searchColumns: ["reviewed_by", "action"], orderBy: "created_at" },
  brand_assets: { table: "brand_assets", searchColumns: ["file_name", "platform_url"], orderBy: "created_at" },
  app_clientes: { table: "app_clientes", searchColumns: ["nome", "empresa", "email"], orderBy: "empresa" },
  app_fases: { table: "app_fases", searchColumns: ["nome", "plataforma"], orderBy: "numero" },
  app_checklist_items: { table: "app_checklist_items", searchColumns: ["texto", "descricao"], orderBy: "ordem" },
  app_conversas: { table: "app_conversas", searchColumns: ["mensagem", "autor"], orderBy: "created_at" },
  app_formulario: { table: "app_formulario", searchColumns: ["nome_app"], orderBy: "created_at" },
  app_prerequisitos: { table: "app_prerequisitos", searchColumns: [], orderBy: "updated_at" },
  app_assets: { table: "app_assets", searchColumns: ["nome_arquivo", "tipo"], orderBy: "created_at" },
  app_notificacoes: { table: "app_notificacoes", searchColumns: ["titulo", "mensagem", "tipo"], orderBy: "created_at" },
  kanban_boards: { table: "kanban_boards", searchColumns: ["title", "description"], orderBy: "created_at" },
  kanban_columns: { table: "kanban_columns", searchColumns: ["title"], orderBy: "sort_order" },
  kanban_card_positions: { table: "kanban_card_positions", searchColumns: [], orderBy: "created_at" },
  carteirizacao_planos: { table: "carteirizacao_planos", searchColumns: ["nome"], orderBy: "nome" },
  carteirizacao_etapas: { table: "carteirizacao_etapas", searchColumns: ["nome"], orderBy: "nome" },
  carteirizacao_cs: { table: "carteirizacao_cs", searchColumns: ["user_email", "user_name"], orderBy: "created_at" },
  carteirizacao_ferias: { table: "carteirizacao_ferias", searchColumns: ["cs_email", "substituto_email"], orderBy: "data_inicio" },
  client_interactions: { table: "client_interactions", searchColumns: ["title", "content"], orderBy: "created_at" },
  client_field_definitions: { table: "client_field_definitions", searchColumns: ["label", "db_key"], orderBy: "sort_order" },
  meeting_csat: { table: "meeting_csat", searchColumns: ["client_email", "client_name"], orderBy: "created_at" },
  meeting_reschedules: { table: "meeting_reschedules", searchColumns: ["reason"], orderBy: "created_at" },
  scorm_packages: { table: "scorm_packages", searchColumns: ["title", "client_name"], orderBy: "created_at" },
  profiles: { table: "profiles", searchColumns: ["email", "display_name"], orderBy: "created_at" },
  cliente_financeiro: { table: "cliente_financeiro", searchColumns: ["id_curseduca", "nome", "email", "meio_de_pagamento", "plano", "status"], orderBy: "created_at" },
};

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
    const entity = url.searchParams.get("entity");

    // If no entity, list all available entities
    if (!entity) {
      const entities = Object.entries(ALLOWED_ENTITIES).map(([key, val]) => ({
        entity: key,
        table: val.table,
        searchable_columns: val.searchColumns,
        default_order: val.orderBy,
      }));
      return new Response(
        JSON.stringify({ entities, total: entities.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = ALLOWED_ENTITIES[entity];
    if (!config) {
      return new Response(
        JSON.stringify({ error: `Entity '${entity}' not found. Use ?entity= without value to list available entities.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "50"), 1000);
    const search = url.searchParams.get("search") || "";
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase.from(config.table).select("*", { count: "exact" });

    if (search && config.searchColumns && config.searchColumns.length > 0) {
      const orFilter = config.searchColumns.map(col => `${col}.ilike.%${search}%`).join(",");
      query = query.or(orFilter);
    }

    // Apply additional filters from query params (excluding reserved params)
    const reserved = ["entity", "page", "per_page", "search"];
    for (const [key, value] of url.searchParams.entries()) {
      if (!reserved.includes(key) && value) {
        query = query.eq(key, value);
      }
    }

    const { data, count, error } = await query
      .range(from, to)
      .order(config.orderBy || "created_at", { ascending: config.orderBy !== "created_at" });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        entity,
        data: data || [],
        total: count || 0,
        page,
        per_page: perPage,
        total_pages: Math.ceil((count || 0) / perPage),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("list-data-api error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
