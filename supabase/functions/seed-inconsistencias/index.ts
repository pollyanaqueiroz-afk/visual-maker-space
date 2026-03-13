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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    
    // Accept any JSON structure - extract the array from the first key
    let records: any[] = [];
    if (Array.isArray(body)) {
      records = body;
    } else {
      // The JSON has a SQL query as key, get the first array value
      const keys = Object.keys(body);
      for (const key of keys) {
        if (Array.isArray(body[key])) {
          records = body[key];
          break;
        }
      }
    }

    if (records.length === 0) {
      return new Response(JSON.stringify({ error: "No records found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clear existing vindi inconsistencias
    await supabase.from("inconsistencias").delete().eq("fonte", "vindi").eq("resolvido", false);

    // Classify and insert
    const rows: any[] = [];
    for (const r of records) {
      rows.push({
        fonte: "vindi",
        tipo: "sem_id_curseduca",
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

    // Insert in batches of 100
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from("inconsistencias").insert(batch);
      if (error) {
        console.error("Batch insert error:", error);
        throw error;
      }
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({ message: "Seed complete", inserted, total_records: records.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("seed-inconsistencias error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
