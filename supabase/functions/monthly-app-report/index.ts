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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const monthLabel = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    // Get all active app clients
    const { data: clients, error: cErr } = await supabase
      .from("app_clientes")
      .select("id, nome, empresa, email, fase_atual, porcentagem_geral, status, plataforma, data_criacao, prazo_estimado")
      .neq("status", "concluido");

    if (cErr) throw cErr;
    if (!clients?.length) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: "No active clients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const FASE_NAMES = [
      "Pré-Requisitos",
      "Primeiros Passos",
      "Validação pela Loja",
      "Criação e Submissão",
      "Aprovação das Lojas",
      "Teste do App",
      "Publicado 🎉",
    ];

    let sent = 0;
    const errors: string[] = [];

    for (const client of clients) {
      try {
        // Fetch phases
        const { data: fases } = await supabase
          .from("app_fases")
          .select("numero, nome, status, porcentagem, data_inicio, data_conclusao, sla_vencimento, sla_violado")
          .eq("cliente_id", client.id)
          .order("numero");

        // Fetch checklist stats for current month
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: recentItems } = await supabase
          .from("app_checklist_items")
          .select("id, feito, feito_em")
          .eq("cliente_id", client.id)
          .eq("feito", true)
          .gte("feito_em", firstOfMonth);

        const completedThisMonth = recentItems?.length || 0;

        // Pending items
        const { data: pendingItems } = await supabase
          .from("app_checklist_items")
          .select("texto, fase_numero, ator")
          .eq("cliente_id", client.id)
          .eq("feito", false)
          .eq("ator", "cliente")
          .order("fase_numero")
          .limit(5);

        // Build timeline HTML
        const timelineRows = (fases || []).map((f) => {
          const statusIcon =
            f.status === "concluida" ? "✅" :
            f.status === "em_andamento" ? "🔄" :
            f.status === "atrasada" ? "🚨" : "🔒";
          const slaStatus =
            f.sla_violado ? '<span style="color:#dc2626;font-weight:bold;">SLA Violado</span>' :
            f.sla_vencimento ? `<span style="color:#16a34a;">No prazo</span>` : "—";
          const startDate = f.data_inicio
            ? new Date(f.data_inicio).toLocaleDateString("pt-BR")
            : "—";
          const endDate = f.data_conclusao
            ? new Date(f.data_conclusao).toLocaleDateString("pt-BR")
            : "—";
          return `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;">${statusIcon} ${f.nome}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${f.porcentagem || 0}%</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${startDate}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${endDate}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${slaStatus}</td>
            </tr>`;
        }).join("");

        // Pending items HTML
        const pendingHtml = (pendingItems || []).length > 0
          ? `<h3 style="color:#333;margin-top:24px;">📋 Próximos passos (suas pendências)</h3>
             <ul style="color:#555;margin-top:8px;">
               ${pendingItems!.map(p => `<li style="margin-bottom:4px;">${p.texto} <span style="color:#999;font-size:12px;">(Fase ${p.fase_numero})</span></li>`).join("")}
             </ul>`
          : `<p style="color:#16a34a;margin-top:24px;">✅ Nenhuma pendência sua no momento!</p>`;

        // SLA summary
        const slaViolations = (fases || []).filter(f => f.sla_violado).length;
        const slaOk = (fases || []).filter(f => f.sla_vencimento && !f.sla_violado && f.status !== "concluida").length;

        const currentFaseName = FASE_NAMES[client.fase_atual] || `Fase ${client.fase_atual}`;

        // Progress bar color
        const pct = client.porcentagem_geral || 0;
        const barColor = pct >= 80 ? "#16a34a" : pct >= 40 ? "#eab308" : "#3b82f6";

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;">
            <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 24px;border-radius:12px 12px 0 0;">
              <h1 style="color:#fff;margin:0;font-size:22px;">📱 Relatório Mensal do seu App</h1>
              <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${client.empresa} — ${monthLabel}</p>
            </div>
            
            <div style="padding:24px;">
              <p style="color:#555;font-size:14px;">Olá, ${client.nome}! 👋</p>
              <p style="color:#555;font-size:14px;">Aqui está o resumo mensal de progresso do seu aplicativo.</p>
              
              <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:16px 0;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                  <span style="font-weight:bold;color:#333;">Progresso Geral</span>
                  <span style="font-weight:bold;color:${barColor};">${pct}%</span>
                </div>
                <div style="background:#e2e8f0;border-radius:999px;height:12px;overflow:hidden;">
                  <div style="background:${barColor};height:100%;width:${pct}%;border-radius:999px;"></div>
                </div>
                <p style="color:#666;font-size:13px;margin-top:12px;">
                  📍 Fase atual: <strong>${currentFaseName}</strong><br>
                  📊 Itens concluídos este mês: <strong>${completedThisMonth}</strong><br>
                  ${slaViolations > 0
                    ? `🚨 SLAs violados: <strong style="color:#dc2626;">${slaViolations}</strong>`
                    : `✅ SLAs no prazo: <strong style="color:#16a34a;">${slaOk}</strong>`
                  }
                </p>
              </div>

              <h3 style="color:#333;margin-top:24px;">📅 Timeline das Fases</h3>
              <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="padding:8px 12px;text-align:left;">Fase</th>
                    <th style="padding:8px 12px;text-align:center;">Progresso</th>
                    <th style="padding:8px 12px;text-align:center;">Início</th>
                    <th style="padding:8px 12px;text-align:center;">Conclusão</th>
                    <th style="padding:8px 12px;text-align:center;">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  ${timelineRows}
                </tbody>
              </table>

              ${pendingHtml}
            </div>

            <div style="background:#f1f5f9;padding:16px 24px;border-radius:0 0 12px 12px;text-align:center;">
              <p style="color:#999;font-size:11px;margin:0;">
                Este e-mail foi gerado automaticamente pelo sistema Curseduca App.<br>
                Em caso de dúvidas, responda diretamente a este e-mail.
              </p>
            </div>
          </div>
        `;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Curseduca App <noreply@curseduca.com>",
            to: [client.email],
            subject: `📱 Relatório Mensal — ${client.empresa} — ${monthLabel}`,
            html,
          }),
        });

        if (emailRes.ok) {
          sent++;
        } else {
          const errText = await emailRes.text();
          console.error(`Failed to send to ${client.email}:`, errText);
          errors.push(`${client.email}: ${errText}`);
        }
      } catch (clientErr: any) {
        console.error(`Error processing ${client.empresa}:`, clientErr.message);
        errors.push(`${client.empresa}: ${clientErr.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total: clients.length,
        sent,
        errors: errors.length,
        errorDetails: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
