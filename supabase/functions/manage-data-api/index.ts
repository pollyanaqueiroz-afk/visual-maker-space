import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPECTED_TOKEN = "WxYVWSfUJ3kslYCkqlyo5DMdsQHzBA1guEvgAlF86T4CiMqPmPbrVEemby5udFaq";

// Whitelist of allowed columns for insert/update on clients
const ALLOWED_CLIENT_FIELDS = [
  "id_curseduca", "nome", "email", "email_alternativo",
  "telefone_alternativo", "data_criacao", "status_financeiro",
  "status_curseduca", "plano", "cs_atual", "cs_anterior",
  "indice_fidelidade",
];

function sanitizePayload(body: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key of ALLOWED_CLIENT_FIELDS) {
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
    // Auth
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

    // ─── POST: Create a new client ───
    if (req.method === "POST") {
      const body = await req.json();
      const payload = sanitizePayload(body);

      if (!payload.id_curseduca) {
        return new Response(
          JSON.stringify({ error: "id_curseduca is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("clients")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PATCH: Update client by id_curseduca ───
    if (req.method === "PATCH") {
      const idCurseduca = url.searchParams.get("id_curseduca");
      if (!idCurseduca) {
        return new Response(
          JSON.stringify({ error: "Query param id_curseduca is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const payload = sanitizePayload(body);

      // Remove id_curseduca from update payload to avoid overwriting the key
      delete payload.id_curseduca;

      if (Object.keys(payload).length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid fields to update. Allowed: " + ALLOWED_CLIENT_FIELDS.join(", ") }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error, count } = await supabase
        .from("clients")
        .update(payload)
        .eq("id_curseduca", idCurseduca)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        return new Response(
          JSON.stringify({ error: `Client with id_curseduca '${idCurseduca}' not found` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: data[0] }),
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
