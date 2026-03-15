import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function toVal(val: string, header: string): unknown {
  const trimmed = val.trim();
  if (trimmed === "" || trimmed === "None") return null;

  const intCols = [
    "tempo_medio_uso_web_minutos", "membros_mes_atual", "membros_mes_m1",
    "membros_mes_m2", "membros_mes_m3", "membros_mes_m4", "membros_ativos_total",
    "dias_desde_ultimo_login", "dias_sem_interacao",
    "certificates_mec_hired", "certificates_mec_used",
  ];
  const bigintCols = [
    "player_bandwidth_hired", "player_bandwidth_used",
    "player_storage_hired", "player_storage_used",
    "ai_tokens_hired", "ai_tokens_used",
  ];
  const floatCols = [
    "indice_fidelidade", "variacao_m0_vs_m1", "variacao_m1_vs_m2",
    "variacao_m2_vs_m3", "variacao_m3_vs_m4", "taxa_retencao_cliente",
    "taxa_retencao_membro", "taxa_ativacao_cliente", "taxa_ativacao_membro",
    "taxa_adocao_app", "player_bandwidth_pct_uso", "player_storage_pct_uso",
    "ai_tokens_pct_uso", "certificates_mec_pct_uso",
  ];
  const boolCols = [
    "alerta_inatividade", "cobranca_automatica_banda_excedente",
    "cobranca_automatica_token_excedente", "gatilho_upgrade_100alunos",
  ];

  if (boolCols.includes(header)) {
    return trimmed.toLowerCase() === "true";
  }
  if (intCols.includes(header)) {
    const n = parseInt(trimmed, 10);
    return isNaN(n) ? null : n;
  }
  if (bigintCols.includes(header)) {
    const n = parseInt(trimmed, 10);
    return isNaN(n) ? null : n;
  }
  if (floatCols.includes(header)) {
    const n = parseFloat(trimmed);
    return isNaN(n) ? null : n;
  }
  return trimmed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let csvText: string;
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.csv_url) {
        const resp = await fetch(body.csv_url);
        csvText = await resp.text();
      } else if (body.csv_text) {
        csvText = body.csv_text;
      } else {
        return new Response(
          JSON.stringify({ error: "Provide csv_url or csv_text in JSON body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      csvText = await req.text();
    }

    const lines = csvText.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV must have header + data rows" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = parseCSVLine(lines[0]);
    const rows: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        const h = headers[j].trim();
        if (!h) continue;
        row[h] = toVal(values[j] || "", h);
      }
      if (row.id_curseduca && String(row.id_curseduca).trim()) {
        // Trim the id_curseduca value
        row.id_curseduca = String(row.id_curseduca).trim();
        row.updated_at = new Date().toISOString();
        rows.push(row);
      }
    }

    const BATCH_SIZE = 200;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("cliente_engajamento_produto")
        .upsert(batch, { onConflict: "id_curseduca" });

      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, total_rows: rows.length, inserted, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("import error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
