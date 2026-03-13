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
    const MANUS_API_URL = Deno.env.get("MANUS_API_URL");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    // action: "validation_result" | "migration_result"
    // status: "validated" | "validation_error" | "completed" | "failed"
    const { project_id, action, status, details, errors: validationErrors } = body;

    if (!project_id) throw new Error("project_id is required");

    // Optional auth check
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

    const { data: project, error: projErr } = await supabase
      .from("migration_projects")
      .select("*")
      .eq("id", project_id)
      .single();
    if (projErr || !project) throw new Error("Project not found");

    const previousStatus = project.migration_status;
    let newStatus: string;
    let notes: string;
    let autoTriggerMigration = false;

    // ── Handle validation results ──
    if (action === "validation_result" || status === "validated" || status === "validation_error") {
      if (status === "validated") {
        // Validation passed → move to extraction and auto-trigger migration
        newStatus = "extraction";
        notes = "✅ Validação automática aprovada pelo Manus IA";
        autoTriggerMigration = true;
      } else {
        // Validation failed → reject and notify migrator
        newStatus = "rejected";
        notes = `❌ Validação falhou: ${details || validationErrors || "erros encontrados"}`;

        // Update validation items if errors provided
        if (validationErrors && Array.isArray(validationErrors)) {
          for (const err of validationErrors) {
            if (err.item_key) {
              await supabase
                .from("migration_validations")
                .update({ status: "rejected", observation: err.message || err.reason })
                .eq("project_id", project_id)
                .eq("item_key", err.item_key);
            }
          }
        }

        // Notify migrator
        const migratorEmail = project.cs_responsible;
        if (migratorEmail) {
          // Insert in-app notification (using a simple approach)
          await supabase.from("migration_status_history").insert({
            project_id,
            from_status: previousStatus,
            to_status: "rejected",
            changed_by: "manus_validation",
            notes: `🔔 ATENÇÃO: Validação do Manus falhou para ${project.client_name}. ${details || "Verifique os dados."}`,
          });
        }
      }
    }
    // ── Handle migration results ──
    else if (action === "migration_result" || status === "completed" || status === "failed" || status === "success") {
      if (status === "completed" || status === "success") {
        newStatus = "completed";
        notes = "✅ Migração concluída pelo Manus IA";
      } else {
        newStatus = "in_progress"; // Keep in_progress for retry
        notes = `❌ Erro no Manus IA: ${details || "erro desconhecido"}`;
      }
    }
    // ── Fallback ──
    else {
      newStatus = previousStatus;
      notes = `Webhook Manus: action=${action}, status=${status}, details=${details || ""}`;
    }

    // Update project
    const updatePayload: Record<string, any> = {
      migration_status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === "rejected") {
      updatePayload.rejected_tag = true;
    }
    if (details && (status === "completed" || status === "success")) {
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

    // ── Auto-trigger migration if validation passed ──
    if (autoTriggerMigration) {
      console.log(`Auto-triggering migration for project ${project_id}`);

      const triggerUrl = `${SUPABASE_URL}/functions/v1/trigger-manus-migration`;
      const triggerResponse = await fetch(triggerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ project_id, action: "migrate" }),
      });

      if (!triggerResponse.ok) {
        console.error("Auto-trigger migration failed:", await triggerResponse.text());
      }
    }

    return new Response(
      JSON.stringify({ success: true, new_status: newStatus, auto_migration: autoTriggerMigration }),
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
