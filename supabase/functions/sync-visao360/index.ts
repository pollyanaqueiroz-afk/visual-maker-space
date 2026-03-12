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
    nome: s(r.cliente_nome),
    email: s(r.email) || null,
    cs_atual: s(r.cs_nome),
    cs_anterior: s(r.cs_nome_anterior) || null,
    plano: s(r.plano_base_consolidada),
    status_financeiro: s(r.status_financeiro) || null,
    status_curseduca: s(r.status_curseduca) || null,
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
    let errors = 0;

    const BATCH_SIZE = 50;

    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);
      const rows = batch
        .map((raw: any) => mapRecord(raw))
        .filter((r: any) => r.id_curseduca);

      if (rows.length === 0) continue;

      const { error } = await supabase
        .from("clients")
        .upsert(rows, { onConflict: "id_curseduca", ignoreDuplicates: false })
        .select("id");

      if (error) {
        console.error(`Erro no batch ${i}:`, error.message);
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
