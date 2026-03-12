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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MANUS_API_KEY = Deno.env.get("MANUS_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { project_id, status, details, error: manusError } = body;

    if (!project_id) throw new Error("project_id is required");

    // Optional: validate webhook authenticity via API key in header
    const authHeader = req.headers.get("authorization");
    if (MANUS_API_KEY && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== MANUS_API_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch current project
    const { data: project, error: projErr } = await supabase
      .from("migration_projects")
      .select("migration_status")
      .eq("id", project_id)
      .single();
    if (projErr || !project) throw new Error("Project not found");

    const previousStatus = project.migration_status;

    // Map Manus status to our status
    let newStatus: string;
    let notes: string;

    switch (status) {
      case "completed":
      case "success":
        newStatus = "completed";
        notes = "Migração concluída pelo Manus IA";
        break;
      case "failed":
      case "error":
        newStatus = "in_progress"; // Keep in_progress so team can retry
        notes = `Erro no Manus IA: ${manusError || details || "erro desconhecido"}`;
        break;
      case "in_progress":
        newStatus = "in_progress";
        notes = `Manus IA em processamento: ${details || ""}`;
        break;
      default:
        newStatus = previousStatus;
        notes = `Webhook Manus: status=${status}, details=${details || ""}`;
    }

    // Update project
    const updatePayload: Record<string, any> = {
      migration_status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (details) {
      updatePayload.migrator_observations = details;
    }

    await supabase
      .from("migration_projects")
      .update(updatePayload)
      .eq("id", project_id);

    // Add history
    await supabase.from("migration_status_history").insert({
      project_id,
      from_status: previousStatus,
      to_status: newStatus,
      changed_by: "manus_webhook",
      notes,
    });

    return new Response(
      JSON.stringify({ success: true, new_status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Manus webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
