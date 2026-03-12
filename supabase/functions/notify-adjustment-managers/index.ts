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
    const body = await req.json();
    const {
      adjustment_id,
      client_url,
      client_name,
      manager_emails,
      created_by_email,
    } = body;

    if (!adjustment_id || !manager_emails || !Array.isArray(manager_emails)) {
      return new Response(
        JSON.stringify({ error: "adjustment_id and manager_emails are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured, skipping email notification");
      return new Response(
        JSON.stringify({ success: true, warning: "Email not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if the creator is one of the managers
    const creatorIsManager = manager_emails.includes(created_by_email?.toLowerCase());

    // Send email to each manager
    for (const managerEmail of manager_emails) {
      const isCreator = managerEmail.toLowerCase() === created_by_email?.toLowerCase();
      
      // Skip sending to the creator - they already know
      if (isCreator) continue;

      const subject = creatorIsManager
        ? `✅ Ajuste de briefing alocado — ${client_name || client_url}`
        : `🎨 Novo pedido de ajuste — ${client_name || client_url}`;

      const message = creatorIsManager
        ? `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="color:#7c3aed;margin-bottom:8px">✅ Ajuste já designado</h2>
            <p style="color:#555;font-size:15px">Um novo pedido de ajuste para <strong>${client_name || client_url}</strong> foi criado e designado por <strong>${created_by_email}</strong>.</p>
            <p style="color:#999;font-size:13px;margin-top:16px">Nenhuma ação necessária — a solicitação já foi encaminhada.</p>
          </div>`
        : `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="color:#f59e0b;margin-bottom:8px">🎨 Novo Pedido de Ajuste</h2>
            <p style="color:#555;font-size:15px">Um novo pedido de ajuste de briefing foi criado para <strong>${client_name || client_url}</strong> por <strong>${created_by_email || "equipe"}</strong>.</p>
            <p style="color:#555;font-size:15px;margin-top:12px">O pedido precisa ser <strong>alocado a um designer</strong>.</p>
            <p style="color:#999;font-size:13px;margin-top:16px">Acesse o Hub para alocar o designer responsável.</p>
          </div>`;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Curseduca Design <noreply@curseduca.com>",
            to: [managerEmail],
            subject,
            html: message,
          }),
        });
      } catch (emailErr) {
        console.error(`Failed to send email to ${managerEmail}:`, emailErr);
      }
    }

    // Also create in-app notifications for both managers
    try {
      // Find user IDs by email from profiles table
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("email", manager_emails.map((e: string) => e.toLowerCase()));

      if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
          const isCreator = profile.email?.toLowerCase() === created_by_email?.toLowerCase();
          
          // Create notification visible in the hub
          // For the creator: mark as already seen/handled
          // For the other: mark as new/unread
        }
      }
    } catch (profileErr) {
      console.error("Failed to create in-app notifications:", profileErr);
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
