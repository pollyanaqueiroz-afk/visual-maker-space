import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const results: string[] = [];

  // 1. Process vacations STARTING today (move clients to substitute)
  const { data: startingVacations } = await supabase
    .from("carteirizacao_ferias")
    .select("*")
    .eq("data_inicio", today)
    .eq("movido_ida", false);

  for (const vacation of startingVacations || []) {
    // Find the CS display_name from the email
    // We need to find clients where cs_atual matches this CS
    // First get the CS name from profiles or cs configs
    const csName = vacation.cs_email;

    // Find all clients assigned to this CS (by email or name)
    const { data: clients } = await supabase
      .from("clients")
      .select("id, cs_atual")
      .or(`cs_atual.eq.${csName}`);

    // Also try by display name from carteirizacao_cs
    const { data: csConfig } = await supabase
      .from("carteirizacao_cs")
      .select("user_name")
      .eq("user_email", csName)
      .limit(1);

    const csDisplayName = csConfig?.[0]?.user_name;
    let allClients = clients || [];

    if (csDisplayName && csDisplayName !== csName) {
      const { data: clientsByName } = await supabase
        .from("clients")
        .select("id, cs_atual")
        .eq("cs_atual", csDisplayName);
      if (clientsByName) {
        const existingIds = new Set(allClients.map((c) => c.id));
        for (const c of clientsByName) {
          if (!existingIds.has(c.id)) allClients.push(c);
        }
      }
    }

    // Also search by email directly
    const { data: clientsByEmail } = await supabase
      .from("clients")
      .select("id, cs_atual")
      .eq("cs_atual", csName);
    if (clientsByEmail) {
      const existingIds = new Set(allClients.map((c) => c.id));
      for (const c of clientsByEmail) {
        if (!existingIds.has(c.id)) allClients.push(c);
      }
    }

    const substituteName = vacation.substituto_nome || vacation.substituto_email;
    let movedCount = 0;

    for (const client of allClients) {
      const { error } = await supabase
        .from("clients")
        .update({
          cs_atual: substituteName,
          cs_anterior: client.cs_atual,
        })
        .eq("id", client.id);
      if (!error) movedCount++;
    }

    // Mark vacation as moved
    await supabase
      .from("carteirizacao_ferias")
      .update({
        movido_ida: true,
        movido_ida_em: new Date().toISOString(),
        clientes_movidos: movedCount,
      })
      .eq("id", vacation.id);

    results.push(
      `IDA: ${csName} → ${substituteName}: ${movedCount} clientes movidos`
    );
  }

  // 2. Process vacations ENDING today (move clients back to original CS)
  const { data: endingVacations } = await supabase
    .from("carteirizacao_ferias")
    .select("*")
    .eq("data_fim", today)
    .eq("movido_ida", true)
    .eq("movido_volta", false);

  for (const vacation of endingVacations || []) {
    const substituteName = vacation.substituto_nome || vacation.substituto_email;

    // Find clients currently with the substitute that have cs_anterior matching original CS
    const csName = vacation.cs_email;
    const { data: csConfig } = await supabase
      .from("carteirizacao_cs")
      .select("user_name")
      .eq("user_email", csName)
      .limit(1);

    const csDisplayName = csConfig?.[0]?.user_name || csName;

    // Find clients with the substitute as cs_atual and original CS as cs_anterior
    const { data: clients } = await supabase
      .from("clients")
      .select("id, cs_atual, cs_anterior")
      .eq("cs_atual", substituteName);

    let movedCount = 0;

    for (const client of clients || []) {
      // Only move back if cs_anterior matches the original CS
      if (
        client.cs_anterior === csDisplayName ||
        client.cs_anterior === csName
      ) {
        const { error } = await supabase
          .from("clients")
          .update({
            cs_atual: client.cs_anterior,
            cs_anterior: substituteName,
          })
          .eq("id", client.id);
        if (!error) movedCount++;
      }
    }

    await supabase
      .from("carteirizacao_ferias")
      .update({
        movido_volta: true,
        movido_volta_em: new Date().toISOString(),
      })
      .eq("id", vacation.id);

    results.push(
      `VOLTA: ${substituteName} → ${csDisplayName}: ${movedCount} clientes devolvidos`
    );
  }

  return new Response(
    JSON.stringify({ ok: true, today, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
