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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Find meetings in the next 30 minutes that haven't been reminded yet
    const now = new Date();
    const in30min = new Date(now.getTime() + 30 * 60 * 1000);
    const todayStr = now.toISOString().slice(0, 10);

    // Get all scheduled meetings for today
    const { data: meetings, error: fetchErr } = await supabase
      .from("meetings")
      .select("id, title, meeting_date, meeting_time, client_name, client_email, meeting_url, created_by, duration_minutes, reminder_sent_at")
      .eq("status", "scheduled")
      .eq("meeting_date", todayStr)
      .is("reminder_sent_at", null);

    if (fetchErr) throw fetchErr;
    if (!meetings || meetings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No meetings to remind", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter meetings happening in the next 30 minutes
    const upcoming = meetings.filter((m) => {
      const [hh, mm] = m.meeting_time.split(":").map(Number);
      const meetingDateTime = new Date(
        now.getFullYear(), now.getMonth(), now.getDate(), hh, mm
      );
      return meetingDateTime > now && meetingDateTime <= in30min;
    });

    if (upcoming.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming meetings in next 30min", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { meeting_id: string; status: string }[] = [];

    for (const meeting of upcoming) {
      // Get the CS email from profiles
      let csEmail: string | null = null;
      if (meeting.created_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, display_name")
          .eq("user_id", meeting.created_by)
          .single();
        csEmail = profile?.email || null;
      }

      const recipients: string[] = [];
      if (csEmail) recipients.push(csEmail);
      if (meeting.client_email && !recipients.includes(meeting.client_email)) {
        recipients.push(meeting.client_email);
      }

      if (recipients.length === 0) {
        results.push({ meeting_id: meeting.id, status: "no_recipients" });
        continue;
      }

      const meetingUrl = meeting.meeting_url || "";
      const meetingLink = meetingUrl
        ? `<p style="margin:16px 0"><a href="${meetingUrl}" style="background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Entrar na reunião</a></p>`
        : "";

      const emailHtml = `
        <div style="font-family:'Sora',Arial,sans-serif;max-width:520px;margin:0 auto;background:#0f172a;border-radius:16px;overflow:hidden;color:#e2e8f0;">
          <div style="background:linear-gradient(135deg,#10b981,#0ea5e9);padding:24px 32px;">
            <h1 style="margin:0;font-size:20px;color:white;">⏰ Lembrete de Reunião</h1>
          </div>
          <div style="padding:24px 32px;">
            <h2 style="margin:0 0 8px;font-size:18px;color:white;">${meeting.title}</h2>
            <p style="color:#94a3b8;margin:0 0 4px;">📅 Hoje às <strong style="color:white;">${meeting.meeting_time.slice(0, 5)}</strong></p>
            <p style="color:#94a3b8;margin:0 0 4px;">⏱️ Duração: ${meeting.duration_minutes} minutos</p>
            ${meeting.client_name ? `<p style="color:#94a3b8;margin:0 0 4px;">👤 Cliente: <strong style="color:white;">${meeting.client_name}</strong></p>` : ""}
            ${meetingLink}
            <p style="color:#64748b;font-size:13px;margin-top:24px;border-top:1px solid #1e293b;padding-top:16px;">
              Esta reunião começa em menos de 30 minutos. Prepare-se!
            </p>
          </div>
        </div>
      `;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Curseduca <noreply@curseduca.com>",
            to: recipients,
            subject: `⏰ Lembrete: ${meeting.title} — hoje às ${meeting.meeting_time.slice(0, 5)}`,
            html: emailHtml,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`Resend error for meeting ${meeting.id}:`, errBody);
          results.push({ meeting_id: meeting.id, status: "email_error" });
          continue;
        }

        // Mark reminder as sent
        await supabase
          .from("meetings")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", meeting.id);

        results.push({ meeting_id: meeting.id, status: "sent" });
      } catch (emailErr: any) {
        console.error(`Email send failed for meeting ${meeting.id}:`, emailErr.message);
        results.push({ meeting_id: meeting.id, status: "error" });
      }
    }

    return new Response(
      JSON.stringify({ message: "Reminders processed", count: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Reminder error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
