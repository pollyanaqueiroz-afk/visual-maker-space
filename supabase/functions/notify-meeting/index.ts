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
  const { createClient: createAuthClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const authSupabase = createAuthClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: claimsData, error: claimsErr } = await authSupabase.auth.getUser();
  if (claimsErr || !claimsData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const body = await req.json();

    // Validate and sanitize inputs
    const sanitize = (v: unknown, max: number) => typeof v === "string" ? v.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, "").trim().slice(0, max) : "";
    const client_email = sanitize(body.client_email, 255);
    const client_name = sanitize(body.client_name, 200);
    const title = sanitize(body.title, 300);
    const meeting_date = sanitize(body.meeting_date, 10);
    const meeting_time = sanitize(body.meeting_time, 8);
    const duration_minutes = typeof body.duration_minutes === "number" && body.duration_minutes > 0 && body.duration_minutes <= 480 ? body.duration_minutes : 30;
    const meeting_url = typeof body.meeting_url === "string" ? body.meeting_url.slice(0, 1000) : null;
    const description = sanitize(body.description, 2000);
    const google_calendar_url = typeof body.google_calendar_url === "string" ? body.google_calendar_url.slice(0, 2000) : null;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!client_email || !emailRegex.test(client_email)) {
      return new Response(
        JSON.stringify({ error: "client_email deve ser um email válido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!title || !meeting_date || !meeting_time) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: title, meeting_date, meeting_time" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meeting_date)) {
      return new Response(
        JSON.stringify({ error: "meeting_date must be YYYY-MM-DD" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format date for display
    const [year, month, day] = meeting_date.split("-");
    const dateFormatted = `${day}/${month}/${year}`;
    const timeFormatted = meeting_time.slice(0, 5);

    const meetingLink = meeting_url
      ? `<p style="margin:12px 0;"><a href="${meeting_url}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:600;">Entrar na Reunião</a></p>`
      : "";

    const calendarLink = google_calendar_url
      ? `<p style="margin:8px 0;"><a href="${google_calendar_url}" style="color:#10b981;text-decoration:underline;font-size:13px;">📅 Adicionar ao Google Calendar</a></p>`
      : "";

    const descriptionBlock = description
      ? `<p style="color:#555;font-size:14px;margin-top:12px;"><strong>Pauta:</strong> ${description}</p>`
      : "";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;">
        <div style="background:#10b981;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="color:#ffffff;margin:0;font-size:20px;">📋 Convite de Reunião</h1>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;">
          <p style="color:#333;font-size:15px;">Olá${client_name ? ` <strong>${client_name}</strong>` : ""},</p>
          <p style="color:#555;font-size:14px;">Você foi convidado(a) para uma reunião:</p>
          <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;">
            <h2 style="color:#111;font-size:17px;margin:0 0 8px;">${title}</h2>
            <p style="color:#555;margin:4px 0;font-size:14px;">📅 <strong>Data:</strong> ${dateFormatted}</p>
            <p style="color:#555;margin:4px 0;font-size:14px;">🕐 <strong>Horário:</strong> ${timeFormatted}</p>
            <p style="color:#555;margin:4px 0;font-size:14px;">⏱️ <strong>Duração:</strong> ${duration_minutes || 30} minutos</p>
          </div>
          ${descriptionBlock}
          ${meetingLink}
          ${calendarLink}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
          <p style="color:#999;font-size:11px;">Este convite foi enviado pela equipe Curseduca Design.</p>
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
        from: "Curseduca Design <noreply@curseduca.com>",
        to: [client_email],
        subject: `Convite: ${title} — ${dateFormatted} às ${timeFormatted}`,
        html,
      }),
    });

    const emailData = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend error:", emailData);
      // Non-blocking: return success with warning
      return new Response(
        JSON.stringify({ success: true, email_warning: true, resend_error: emailData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
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
