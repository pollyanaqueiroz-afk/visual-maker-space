import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Curseduca <noreply@curseduca.com>";
    const TEAM_EMAIL = Deno.env.get("TEAM_REPORT_EMAIL") || "implantacao@curseduca.com";

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: completedArts } = await supabase
      .from("briefing_images")
      .select("id, image_type, assigned_email, created_at, deadline")
      .eq("status", "completed")
      .gte("updated_at", weekAgo);

    const { data: overdueArts } = await supabase
      .from("briefing_images")
      .select("id, image_type, assigned_email, deadline")
      .in("status", ["pending", "in_progress"])
      .not("deadline", "is", null)
      .lt("deadline", now);

    const { data: revisions } = await supabase
      .from("briefing_reviews")
      .select("id, action")
      .eq("action", "revision_requested")
      .gte("created_at", weekAgo);

    const { data: newRequests } = await supabase
      .from("briefing_requests")
      .select("id")
      .gte("created_at", weekAgo);

    const { data: pendingReview } = await supabase
      .from("briefing_images")
      .select("id")
      .eq("status", "review");

    const completedCount = completedArts?.length || 0;
    const overdueCount = overdueArts?.length || 0;
    const revisionCount = revisions?.length || 0;
    const newCount = newRequests?.length || 0;
    const pendingReviewCount = pendingReview?.length || 0;

    const designerStats: Record<string, { completed: number; overdue: number }> = {};
    (completedArts || []).forEach((a: any) => {
      const e = a.assigned_email || "Sem designer";
      if (!designerStats[e]) designerStats[e] = { completed: 0, overdue: 0 };
      designerStats[e].completed++;
    });
    (overdueArts || []).forEach((a: any) => {
      const e = a.assigned_email || "Sem designer";
      if (!designerStats[e]) designerStats[e] = { completed: 0, overdue: 0 };
      designerStats[e].overdue++;
    });

    const designerRows = Object.entries(designerStats)
      .sort(([, a], [, b]) => b.completed - a.completed)
      .map(
        ([email, stats]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px">${email}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#10b981;font-weight:600">${stats.completed}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:${stats.overdue > 0 ? '#ef4444' : '#94a3b8'};font-weight:600">${stats.overdue}</td>
        </tr>`
      )
      .join("");

    const slaCompliance =
      completedCount > 0
        ? Math.round(
            ((completedArts || []).filter((a: any) => {
              if (!a.deadline) return true;
              return new Date(a.deadline) >= new Date(a.created_at);
            }).length /
              completedCount) *
              100
          )
        : 100;

    const today = new Date();
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateRange = `${weekStart.toLocaleDateString("pt-BR")} — ${today.toLocaleDateString("pt-BR")}`;

    const toList = TEAM_EMAIL.split(",").map((e: string) => e.trim());

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: toList,
        subject: `📊 Relatório Semanal de Briefings — ${completedCount} concluídas, ${overdueCount} atrasadas`,
        html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:24px 32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;font-size:20px;margin:0">📊 Relatório Semanal</h1>
    <p style="color:#94a3b8;font-size:13px;margin:4px 0 0">${dateRange}</p>
  </div>

  <div style="padding:24px 32px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td style="text-align:center;padding:12px">
          <div style="font-size:28px;font-weight:700;color:#10b981">${completedCount}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase">Concluídas</div>
        </td>
        <td style="text-align:center;padding:12px">
          <div style="font-size:28px;font-weight:700;color:#ef4444">${overdueCount}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase">Atrasadas</div>
        </td>
        <td style="text-align:center;padding:12px">
          <div style="font-size:28px;font-weight:700;color:#3b82f6">${newCount}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase">Novas</div>
        </td>
        <td style="text-align:center;padding:12px">
          <div style="font-size:28px;font-weight:700;color:#f59e0b">${revisionCount}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase">Refações</div>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td style="text-align:center;padding:12px;background:#f0fdf4;border-radius:8px">
          <div style="font-size:24px;font-weight:700;color:#10b981">${slaCompliance}%</div>
          <div style="font-size:11px;color:#64748b">SLA Compliance</div>
        </td>
        <td style="width:12px"></td>
        <td style="text-align:center;padding:12px;background:#fef3c7;border-radius:8px">
          <div style="font-size:24px;font-weight:700;color:#f59e0b">${pendingReviewCount}</div>
          <div style="font-size:11px;color:#64748b">Aguardando cliente</div>
        </td>
      </tr>
    </table>

    <h3 style="font-size:14px;color:#1e293b;margin:20px 0 8px">Desempenho por Designer</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase">Designer</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase">Concluídas</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase">Atrasadas</th>
        </tr>
      </thead>
      <tbody>
        ${designerRows || '<tr><td colspan="3" style="padding:12px;text-align:center;color:#94a3b8;font-size:13px">Nenhum designer com entregas</td></tr>'}
      </tbody>
    </table>
  </div>

  <div style="padding:16px 32px;background:#f8fafc;border-radius:0 0 12px 12px;text-align:center">
    <p style="font-size:11px;color:#94a3b8;margin:0">Relatório gerado automaticamente pelo Hub de Operações Curseduca</p>
  </div>
</div>`,
      }),
    });

    return new Response(
      JSON.stringify({ success: true, completed: completedCount, overdue: overdueCount, sla: slaCompliance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("weekly-team-report error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
