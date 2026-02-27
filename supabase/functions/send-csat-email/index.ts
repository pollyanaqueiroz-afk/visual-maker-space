import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const body = await req.json();
    const { meeting_id, client_email, client_name, meeting_title, meeting_date } = body;

    if (!meeting_id || !client_email) {
      return new Response(
        JSON.stringify({ error: "meeting_id and client_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create CSAT entry with unique token
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: csatEntry, error: insertErr } = await adminSupabase
      .from("meeting_csat")
      .insert({
        meeting_id,
        client_email,
        client_name: client_name || null,
      })
      .select("token")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      throw new Error("Failed to create CSAT entry");
    }

    const baseUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", "").includes("localhost")
      ? "http://localhost:5173"
      : req.headers.get("origin") || "https://visual-maker-space.lovable.app";

    const csatUrl = `${baseUrl}/csat/${csatEntry.token}`;

    const [year, month, day] = (meeting_date || "").split("-");
    const dateFormatted = year ? `${day}/${month}/${year}` : "recente";

    const sanitize = (v: unknown, max: number) =>
      typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().slice(0, max) : "";

    const safeTitle = sanitize(meeting_title, 300) || "Reunião";
    const safeName = sanitize(client_name, 200);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
        <div style="background:#6366f1;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="color:#ffffff;margin:0;font-size:20px;">⭐ Como foi sua reunião?</h1>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;">
          <p style="color:#333;font-size:15px;">Olá${safeName ? ` <strong>${safeName}</strong>` : ""},</p>
          <p style="color:#555;font-size:14px;">Gostaríamos de saber como foi sua experiência na reunião:</p>
          <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
            <h2 style="color:#111;font-size:17px;margin:0 0 8px;">${safeTitle}</h2>
            <p style="color:#555;margin:4px 0;font-size:14px;">📅 Data: ${dateFormatted}</p>
          </div>
          <p style="color:#555;font-size:14px;">Sua opinião é muito importante para melhorarmos nosso atendimento.</p>
          <p style="margin:20px 0;text-align:center;">
            <a href="${csatUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px;">
              Avaliar Reunião
            </a>
          </p>
          <p style="color:#999;font-size:12px;text-align:center;">Leva menos de 30 segundos</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
          <p style="color:#999;font-size:11px;">Este e-mail foi enviado pela equipe Curseduca.</p>
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
        from: "Curseduca <noreply@curseduca.com>",
        to: [client_email],
        subject: `⭐ Como foi sua reunião? — ${safeTitle}`,
        html,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend error:", emailData);
      return new Response(
        JSON.stringify({ success: true, email_warning: true, resend_error: emailData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, token: csatEntry.token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
