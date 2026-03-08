import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Curseduca <noreply@curseduca.com>";
    const APP_URL = Deno.env.get("APP_URL") || "https://visual-maker-space.lovable.app";

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Arts in review for more than 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleReviews, error } = await supabase
      .from("briefing_images")
      .select("id, image_type, product_name, updated_at, briefing_requests!inner(requester_name, requester_email, platform_url, review_token)")
      .eq("status", "review")
      .lt("updated_at", threeDaysAgo);

    if (error) throw error;

    // Group by client email
    const byEmail: Record<string, { name: string; email: string; reviewToken: string; arts: any[] }> = {};
    for (const img of staleReviews || []) {
      const req = (img as any).briefing_requests;
      const email = req.requester_email;
      if (!byEmail[email]) {
        byEmail[email] = { name: req.requester_name, email, reviewToken: req.review_token, arts: [] };
      }
      byEmail[email].arts.push(img);
    }

    let sentCount = 0;
    const imageTypeLabels: Record<string, string> = {
      login: "Área de Login",
      banner_vitrine: "Banner Vitrine",
      product_cover: "Capa de Produto",
      trail_banner: "Banner de Trilha",
      challenge_banner: "Banner de Desafio",
      community_banner: "Banner de Comunidade",
      app_mockup: "Mockup do Aplicativo",
    };

    for (const client of Object.values(byEmail)) {
      const reviewUrl = client.reviewToken
        ? `${APP_URL}/client-review?token=${client.reviewToken}`
        : `${APP_URL}/client-review?email=${encodeURIComponent(client.email)}`;

      const artsList = client.arts
        .map(
          (a: any) =>
            `<li style="padding:6px 0;border-bottom:1px solid #f0f0f0">${imageTypeLabels[a.image_type] || a.image_type}${a.product_name ? " — " + a.product_name : ""}</li>`
        )
        .join("");

      const daysWaiting = Math.ceil(
        (Date.now() - new Date(client.arts[0].updated_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [client.email],
            subject: `⏰ Lembrete: ${client.arts.length} arte(s) aguardando sua aprovação há ${daysWaiting} dias`,
            html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1e293b;font-size:20px;margin-bottom:16px">⏰ Lembrete de Aprovação</h2>
  <p style="color:#475569;font-size:14px;line-height:1.6">
    Olá ${client.name?.split(" ")[0] || ""}! Você tem <strong>${client.arts.length}</strong> arte(s) aguardando sua aprovação há <strong>${daysWaiting} dias</strong>:
  </p>
  <ul style="list-style:none;padding:0;margin:16px 0;background:#f8fafc;border-radius:8px;padding:12px 16px">
    ${artsList}
  </ul>
  <div style="text-align:center;margin:24px 0">
    <a href="${reviewUrl}" style="display:inline-block;background:#10b981;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
      Revisar e Aprovar →
    </a>
  </div>
  <p style="color:#94a3b8;font-size:12px;line-height:1.5">
    Sua aprovação é essencial para darmos continuidade ao projeto. Se precisar de ajustes, você pode solicitar refação diretamente pelo link acima.
  </p>
</div>`,
          }),
        });
        await res.text(); // consume body
        sentCount++;
      } catch (emailErr) {
        console.error(`Failed to send follow-up to ${client.email}:`, emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        sent: sentCount,
        clients: Object.keys(byEmail).length,
        staleArts: (staleReviews || []).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("follow-up-review error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
