import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the user is authenticated
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { fonte, records } = body as { fonte: string; records: any[] };

    if (!fonte || !records || !Array.isArray(records)) {
      return new Response(JSON.stringify({ error: "Missing fonte or records array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Classify each record into inconsistency types
    const rows: any[] = [];
    for (const r of records) {
      const tipos: string[] = [];

      if (!r.id_curseduca && r.vigencia_assinatura === "Ativa") {
        tipos.push("sem_id_curseduca");
      }
      if (r.id_curseduca && r.status === "Inadimplente" && r.vigencia_assinatura === "Ativa") {
        tipos.push("inadimplente_ativo");
      }
      if (r.id_curseduca && (!r.nome || !r.email) && r.vigencia_assinatura === "Ativa") {
        tipos.push("sem_nome_email");
      }

      for (const tipo of tipos) {
        rows.push({
          fonte,
          tipo,
          id_curseduca: r.id_curseduca || null,
          nome: r.nome || null,
          email: r.email || null,
          codigo_assinatura_meio_pagamento: r.codigo_assinatura_meio_pagamento || null,
          codigo_cliente_meio_pagamento: r.codigo_cliente_meio_pagamento || null,
          plano: r.plano || null,
          meio_de_pagamento: r.meio_de_pagamento || null,
          valor_contratado: r.valor_contratado ?? null,
          numero_parcelas_pagas: r.numero_parcelas_pagas ?? null,
          numero_parcelas_inadimplentes: r.numero_parcelas_inadimplentes ?? null,
          numero_parcelas_contrato: r.numero_parcelas_contrato ?? null,
          recorrencia_pagamento: r.recorrencia_pagamento || null,
          is_plano: r.is_plano ?? null,
          is_upsell: r.is_upsell ?? null,
          tipo_produto_master: r.tipo_produto_master || null,
          nome_plano_master: r.nome_plano_master || null,
          status: r.status || null,
          vigencia_assinatura: r.vigencia_assinatura || null,
          data_criacao: r.data_criacao || null,
        });
      }
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ message: "No inconsistencies found", inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clear existing records for this fonte before inserting fresh data
    await supabase.from("inconsistencias").delete().eq("fonte", fonte).eq("resolvido", false);

    // Insert in batches of 500
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase.from("inconsistencias").insert(batch);
      if (error) {
        console.error("Insert batch error:", error);
        throw error;
      }
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({ message: "Import complete", inserted, total_records: records.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("import-inconsistencias error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
