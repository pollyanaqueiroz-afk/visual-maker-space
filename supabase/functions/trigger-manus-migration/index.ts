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
    const MANUS_API_KEY = Deno.env.get("MANUS_API_KEY");
    if (!MANUS_API_KEY) throw new Error("MANUS_API_KEY not configured");
    const masked = MANUS_API_KEY.length > 12
      ? `${MANUS_API_KEY.slice(0, 6)}...${MANUS_API_KEY.slice(-6)} (len=${MANUS_API_KEY.length})`
      : `[too short, len=${MANUS_API_KEY.length}]`;
    console.log(`DEBUG MANUS_API_KEY: ${masked}`);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // 4. Build payload
    const webhookUrl = `${SUPABASE_URL}/functions/v1/manus-webhook`;

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
      action,
      project_id: project.id,
      id_curseduca,
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

    // 5. Discover correct Manus project_id via API
    const MANUS_BASE = "https://api.manus.im/v1";
    const manusHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${MANUS_API_KEY}`,
    };

    console.log("Fetching Manus projects to discover correct project_id...");
    const projectsRes = await fetch(`${MANUS_BASE}/projects`, {
      method: "GET",
      headers: manusHeaders,
    });
    const projectsBody = await projectsRes.text();
    console.log(`GET /v1/projects status: ${projectsRes.status}`);
    console.log(`GET /v1/projects body: ${projectsBody}`);

    if (!projectsRes.ok) {
      throw new Error(`Manus API /projects error [${projectsRes.status}]: ${projectsBody}`);
    }

    let manusProjects: any;
    try { manusProjects = JSON.parse(projectsBody); } catch { manusProjects = null; }

    // Try to find "Migrações" project, fallback to first project
    let manusProjectId: string | null = null;
    const projectList = Array.isArray(manusProjects) ? manusProjects : manusProjects?.data || manusProjects?.projects || [];
    
    for (const p of projectList) {
      const name = (p.name || p.title || "").toLowerCase();
      if (name.includes("migra")) {
        manusProjectId = p.id || p.project_id;
        break;
      }
    }
    if (!manusProjectId && projectList.length > 0) {
      manusProjectId = projectList[0].id || projectList[0].project_id;
    }
    if (!manusProjectId) {
      throw new Error(`No Manus projects found. Response: ${projectsBody}`);
    }

    console.log(`Using Manus project_id: ${manusProjectId}`);

    // 6. Build message and send task
    const actionLabel = action === "validate"
      ? "Validar dados de migração"
      : "Iniciar migração";
    const message = `${actionLabel}. Payload:\n\n${JSON.stringify(payload, null, 2)}`;

    console.log(`Sending task to Manus API: ${MANUS_BASE}/tasks`);
    console.log(`Action: ${action}`);

    const manusResponse = await fetch(`${MANUS_BASE}/tasks`, {
      method: "POST",
      headers: manusHeaders,
      body: JSON.stringify({
        project_id: manusProjectId,
        prompt: message,
      }),
    });

    const manusResponseBody = await manusResponse.text();

    // 7. Log response details
    console.log(`Manus API HTTP status: ${manusResponse.status}`);
    console.log(`Manus API response body: ${manusResponseBody}`);

    if (!manusResponse.ok) {
      console.error(`Manus API error [${manusResponse.status}]: ${manusResponseBody}`);
      throw new Error(`Manus API error [${manusResponse.status}]: ${manusResponseBody}`);
    }

    let manusResult;
    try {
      manusResult = JSON.parse(manusResponseBody);
    } catch {
      manusResult = { raw: manusResponseBody };
    }

    // 8. Update project status
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
