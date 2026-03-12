import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPECTED_TOKEN = "WxYVWSfUJ3kslYCkqlyo5DMdsQHzBA1guEvgAlF86T4CiMqPmPbrVEemby5udFaq";

// Whitelist per entity
const ALLOWED_FIELDS: Record<string, string[]> = {
  clients: [
    "id_curseduca", "nome", "email", "email_alternativo",
    "telefone_alternativo", "data_criacao", "status_financeiro",
    "status_curseduca", "plano", "cs_atual", "cs_anterior",
    "indice_fidelidade",
  ],
  cliente_financeiro: [
    "id_curseduca", "nome", "email", "codigo_assinatura_meio_pagamento",
    "codigo_cliente_meio_pagamento", "plano", "meio_de_pagamento",
    "meio_pagamento", "valor_contratado", "numero_parcelas_pagas",
    "numero_parcelas_inadimplentes", "numero_parcelas_contrato",
    "recorrencia_pagamento", "is_plano", "tipo_plano", "is_upsell",
    "tipo_upsell", "status", "vigencia_assinatura", "data_criacao",
    "processed_at",
  ],
};

function sanitizePayload(body: Record<string, unknown>, entity: string): Record<string, unknown> {
  const allowed = ALLOWED_FIELDS[entity] || [];
  const clean: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      clean[key] = body[key];
    }
  }
  return clean;
}

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
    const entity = url.searchParams.get("entity") || "clients";

    if (!ALLOWED_FIELDS[entity]) {
      return new Response(
        JSON.stringify({ error: `Entity '${entity}' not supported. Available: ${Object.keys(ALLOWED_FIELDS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── POST: Create a new record ───
    if (req.method === "POST") {
      const body = await req.json();
      const payload = sanitizePayload(body, entity);

      if (!payload.id_curseduca) {
        return new Response(
          JSON.stringify({ error: "id_curseduca is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from(entity)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PATCH: Update record by composite key ───
    if (req.method === "PATCH") {
      const idCurseduca = url.searchParams.get("id_curseduca");
      if (!idCurseduca) {
        return new Response(
          JSON.stringify({ error: "Query param id_curseduca is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const payload = sanitizePayload(body, entity);
      delete payload.id_curseduca;
      delete payload.codigo_assinatura_meio_pagamento;

      if (Object.keys(payload).length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid fields to update. Allowed: " + ALLOWED_FIELDS[entity].join(", ") }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let query = supabase.from(entity).update(payload).eq("id_curseduca", idCurseduca);

      // For cliente_financeiro, use composite key: id_curseduca + codigo_assinatura_meio_pagamento
      if (entity === "cliente_financeiro") {
        const codigoAssinatura = url.searchParams.get("codigo_assinatura_meio_pagamento");
        if (codigoAssinatura) {
          query = query.eq("codigo_assinatura_meio_pagamento", codigoAssinatura);
        }
      }

      const { data, error } = await query.select();

      if (error) throw error;

      if (!data || data.length === 0) {
        return new Response(
          JSON.stringify({ error: `Record not found in ${entity} with the given key(s)` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: data.length === 1 ? data[0] : data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST (create) or PATCH (update)." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("manage-data-api error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
