import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();

    // 1. Clients inactive > 48h — create notification
    const { data: inactive48 } = await supabase
      .from("app_clientes")
      .select("id, nome, empresa, portal_token")
      .lt("ultima_acao_cliente", new Date(now.getTime() - 48 * 3600000).toISOString())
      .neq("status", "concluido");

    for (const c of inactive48 || []) {
      // Check if already notified today
      const { data: existing } = await supabase
        .from("app_notificacoes")
        .select("id")
        .eq("cliente_id", c.id)
        .eq("tipo", "cliente_inativo_48h")
        .gte("created_at", new Date(now.getTime() - 24 * 3600000).toISOString())
        .limit(1);

      if (!existing?.length) {
        await supabase.from("app_notificacoes").insert({
          cliente_id: c.id,
          tipo: "cliente_inativo_48h",
          canal: "email",
          destinatario: "cliente",
          titulo: "Seu app está te esperando!",
          mensagem: `Olá ${c.nome}! 👋 Seu app ${c.empresa} está te esperando. Acesse o portal para continuar.`,
          agendado_para: now.toISOString(),
        });
      }
    }

    // 2. Clients inactive > 96h — alert CS
    const { data: inactive96 } = await supabase
      .from("app_clientes")
      .select("id, nome, empresa")
      .lt("ultima_acao_cliente", new Date(now.getTime() - 96 * 3600000).toISOString())
      .neq("status", "concluido");

    for (const c of inactive96 || []) {
      const { data: existing } = await supabase
        .from("app_notificacoes")
        .select("id")
        .eq("cliente_id", c.id)
        .eq("tipo", "cliente_inativo_96h")
        .gte("created_at", new Date(now.getTime() - 24 * 3600000).toISOString())
        .limit(1);

      if (!existing?.length) {
        await supabase.from("app_notificacoes").insert({
          cliente_id: c.id,
          tipo: "cliente_inativo_96h",
          canal: "portal",
          destinatario: "cs",
          titulo: "⚠️ Cliente inativo há +96h",
          mensagem: `${c.nome} (${c.empresa}) está inativo há mais de 96 horas.`,
          agendado_para: now.toISOString(),
        });

        // Update client status
        await supabase.from("app_clientes").update({ status: "atrasado" }).eq("id", c.id);
      }
    }

    // 3. Check SLA violations
    const { data: slaFases } = await supabase
      .from("app_fases")
      .select("id, cliente_id, numero, nome")
      .lt("sla_vencimento", now.toISOString())
      .eq("sla_violado", false)
      .not("status", "eq", "concluida");

    for (const f of slaFases || []) {
      await supabase.from("app_fases").update({ sla_violado: true, status: "atrasada" }).eq("id", f.id);
      await supabase.from("app_notificacoes").insert({
        cliente_id: f.cliente_id,
        tipo: "sla_violado",
        canal: "portal",
        destinatario: "analista",
        titulo: "🚨 SLA vencido",
        mensagem: `SLA da fase ${f.numero} (${f.nome}) expirou.`,
        agendado_para: now.toISOString(),
      });
    }

    // 4. Process pending notifications
    const { data: pending } = await supabase
      .from("app_notificacoes")
      .select("*")
      .eq("enviado", false)
      .lte("agendado_para", now.toISOString())
      .limit(50);

    let processed = 0;
    for (const n of pending || []) {
      // For now, just mark as sent (email/whatsapp integration can be added later)
      await supabase.from("app_notificacoes").update({ enviado: true, enviado_em: now.toISOString() }).eq("id", n.id);
      processed++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        inactive48: inactive48?.length || 0,
        inactive96: inactive96?.length || 0,
        slaViolations: slaFases?.length || 0,
        notificationsProcessed: processed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
