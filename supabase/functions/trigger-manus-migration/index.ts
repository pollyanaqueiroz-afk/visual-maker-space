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
    const MANUS_API_URL = Deno.env.get("MANUS_API_URL");
    if (!MANUS_API_URL) throw new Error("MANUS_API_URL not configured");

    const MANUS_API_KEY = Deno.env.get("MANUS_API_KEY");
    if (!MANUS_API_KEY) throw new Error("MANUS_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // action: "validate" (default after form) or "migrate" (start migration)
    const { project_id, action = "validate" } = await req.json();
    if (!project_id) throw new Error("project_id is required");

    // 1. Fetch migration project
    const { data: project, error: projErr } = await supabase
      .from("migration_projects")
      .select("*")
      .eq("id", project_id)
      .single();
    if (projErr || !project) throw new Error("Project not found");

    // 2. Fetch latest form submission
    const { data: submission } = await supabase
      .from("migration_form_submissions")
      .select("*")
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Fetch clubs from latest submission
    let clubs: any[] = [];
    if (submission) {
      const { data: clubData } = await supabase
        .from("migration_clubs")
        .select("*")
        .eq("submission_id", submission.id);
      clubs = clubData || [];
    }

    // 4. Build payload for Manus
    // The POST sends all relevant migration data so Manus can:
    //   - Identify the Curseduca client via `id_curseduca` (extracted from client_url)
    //   - Access the source platform clubs and API credentials
    //   - Report back progress via the webhook_url
    const webhookUrl = `${SUPABASE_URL}/functions/v1/manus-webhook`;

    // Extract id_curseduca from client_url (e.g. "escola.curseduca.com" → "escola")
    const extractIdCurseduca = (url: string): string => {
      try {
        const cleaned = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return cleaned.split('.')[0] || url;
      } catch {
        return url;
      }
    };

    const id_curseduca = extractIdCurseduca(project.client_url);

    const payload = {
      action, // "validate" or "migrate"
      project_id: project.id,
      id_curseduca, // Identificador Curseduca do cliente (subdomínio)
      client_name: project.client_name,
      client_email: project.client_email,
      client_url: project.client_url,
      platform_origin: project.platform_origin,
      webhook_url: webhookUrl,
      form_data: submission
        ? {
            api_client_id: submission.api_client_id,
            api_client_secret: submission.api_client_secret,
            api_basic: submission.api_basic,
            members_spreadsheet_url: submission.members_spreadsheet_url,
            members_spreadsheet_name: submission.members_spreadsheet_name,
          }
        : null,
      clubs: clubs.map((c: any) => ({
        club_name: c.club_name,
        club_url: c.club_url,
      })),
    };

    // 5. Send to Manus API
    const manusResponse = await fetch(MANUS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MANUS_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!manusResponse.ok) {
      const errorBody = await manusResponse.text();
      throw new Error(`Manus API error [${manusResponse.status}]: ${errorBody}`);
    }

    const manusResult = await manusResponse.json();

    // 6. Update project status based on action
    const newStatus = action === "validate" ? "analysis" : "in_progress";
    const notes = action === "validate"
      ? "Dados enviados ao Manus IA para validação automática"
      : "Migração iniciada pelo Manus IA";

    await supabase
      .from("migration_projects")
      .update({
        migration_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project_id);

    await supabase.from("migration_status_history").insert({
      project_id,
      from_status: project.migration_status,
      to_status: newStatus,
      changed_by: action === "validate" ? "manus_auto_validate" : "manus_trigger",
      notes,
    });

    return new Response(
      JSON.stringify({ success: true, action, manus_response: manusResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error triggering Manus:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
