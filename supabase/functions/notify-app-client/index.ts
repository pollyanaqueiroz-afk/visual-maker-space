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

    // Check if this is a direct call with body (e.g. app_publicado)
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    // Handle app_publicado email
    if (body?.tipo === 'app_publicado') {
      const { cliente_id, plataforma, url_loja } = body;
      const { data: cliente } = await supabase.from('app_clientes').select('nome, email, empresa').eq('id', cliente_id).single();
      if (!cliente?.email) throw new Error('Email do cliente não encontrado');

      const lojaName = plataforma === 'google' ? 'Google Play' : 'App Store';
      const emoji = plataforma === 'google' ? '🤖' : '🍎';

      const html = `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; color: white; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #10b981, #3b82f6); padding: 40px 30px; text-align: center;">
            <h1 style="font-size: 28px; margin: 0; color: white;">🎉 Parabéns, ${cliente.nome?.split(' ')[0]}!</h1>
            <p style="font-size: 16px; margin-top: 10px; opacity: 0.9; color: white;">Seu aplicativo está oficialmente no ar!</p>
          </div>
          <div style="padding: 30px;">
            <p style="font-size: 15px; color: #94a3b8; line-height: 1.6;">
              O aplicativo da <strong style="color: white;">${cliente.empresa}</strong> 
              foi publicado com sucesso na <strong style="color: white;">${emoji} ${lojaName}</strong>.
            </p>
            <div style="background: #1E293B; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="font-size: 13px; color: #64748b; margin: 0 0 12px;">Acesse seu app agora:</p>
              <a href="${url_loja}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #3b82f6); color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: bold; font-size: 15px;">
                Abrir na ${lojaName} →
              </a>
            </div>
            <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
              Agradecemos por confiar na Curseduca para construir o app da sua plataforma. 
              Se precisar de qualquer ajuda, estamos à disposição!
            </p>
            <p style="font-size: 14px; color: #94a3b8; margin-top: 20px;">
              Com carinho,<br/><strong style="color: white;">Equipe Curseduca</strong> 🚀
            </p>
          </div>
        </div>`;

      // Send via Resend
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Curseduca Apps <apps@membros.app.br>",
              to: [cliente.email],
              subject: `${emoji} Seu app está na ${lojaName}! 🎉`,
              html,
            }),
          });
        } catch (emailErr) {
          console.error("Email send failed (non-blocking):", emailErr);
        }
      }

      return new Response(
        JSON.stringify({ ok: true, tipo: 'app_publicado', email: cliente.email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Original scheduled notification logic
    const now = new Date();

    // 1. Clients inactive > 48h
    const { data: inactive48 } = await supabase
      .from("app_clientes")
      .select("id, nome, empresa, portal_token")
      .lt("ultima_acao_cliente", new Date(now.getTime() - 48 * 3600000).toISOString())
      .neq("status", "concluido");

    for (const c of inactive48 || []) {
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

    // 2. Clients inactive > 96h
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
