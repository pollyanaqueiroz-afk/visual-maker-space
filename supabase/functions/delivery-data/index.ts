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
    const action = typeof body.action === "string" ? body.action.trim().slice(0, 50) : "";
    const token = typeof body.token === "string" ? body.token.trim().slice(0, 100) : "";
    const image_id = typeof body.image_id === "string" ? body.image_id.trim().slice(0, 100) : "";
    const image_ids = Array.isArray(body.image_ids) ? body.image_ids.filter((id: unknown) => typeof id === "string").slice(0, 100) : [];
    const status = typeof body.status === "string" ? body.status.trim().slice(0, 50) : "";
    const file_url = typeof body.file_url === "string" ? body.file_url.slice(0, 2000) : "";
    const comments = typeof body.comments === "string" ? body.comments.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").slice(0, 2000) : "";
    const delivered_by_email = typeof body.delivered_by_email === "string" ? body.delivered_by_email.replace(/<[^>]*>/g, "").trim().slice(0, 255) : "";
    const revision_count = typeof body.revision_count === "number" && body.revision_count >= 0 && body.revision_count <= 100 ? body.revision_count : undefined;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validStatuses = ["pending", "in_progress", "review", "completed", "cancelled"];

    if (!action) {
      return new Response(
        JSON.stringify({ error: "action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // FETCH: Get briefing image by delivery token
    if (action === "fetch") {
      if (!token || !uuidRegex.test(token)) {
        return new Response(
          JSON.stringify({ error: "token must be a valid UUID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("briefing_images")
        .select("id, image_type, product_name, image_text, deadline, assigned_email, status, observations, orientation, briefing_requests!inner(requester_name, platform_url)")
        .eq("delivery_token", token)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SUBMIT: Record a delivery and update status
    if (action === "submit") {
      if (!image_id || !uuidRegex.test(image_id)) {
        return new Response(
          JSON.stringify({ error: "image_id must be a valid UUID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!file_url || !delivered_by_email) {
        return new Response(
          JSON.stringify({ error: "file_url and delivered_by_email are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(delivered_by_email)) {
        return new Response(
          JSON.stringify({ error: "delivered_by_email must be a valid email" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert delivery record
      const { error: insertErr } = await supabase
        .from("briefing_deliveries")
        .insert({
          briefing_image_id: image_id,
          file_url,
          comments: comments || null,
          delivered_by_email,
        });

      if (insertErr) throw insertErr;

      // Update image status to review
      await supabase
        .from("briefing_images")
        .update({ status: "review" })
        .eq("id", image_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ENRICH_ASSETS: Get briefing image and request info for asset enrichment
    if (action === "enrich_assets") {
      if (!image_ids || !Array.isArray(image_ids) || image_ids.length === 0) {
        return new Response(
          JSON.stringify({ images: [], requests: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: imgData } = await supabase
        .from("briefing_images")
        .select("id, image_type, request_id")
        .in("id", image_ids.slice(0, 100));

      const requestIds = [...new Set((imgData || []).map((i: any) => i.request_id))];
      let reqData: any[] = [];
      if (requestIds.length > 0) {
        const { data } = await supabase
          .from("briefing_requests")
          .select("id, requester_name, created_at")
          .in("id", requestIds);
        reqData = data || [];
      }

      return new Response(
        JSON.stringify({ images: imgData || [], requests: reqData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE_STATUS: For client review approve/reject
    if (action === "update_status") {
      if (!image_id || !uuidRegex.test(image_id)) {
        return new Response(
          JSON.stringify({ error: "image_id must be a valid UUID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!status || !validStatuses.includes(status)) {
        return new Response(
          JSON.stringify({ error: "status must be one of: " + validStatuses.join(", ") }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updatePayload: Record<string, any> = { status };
      if (typeof revision_count === "number") {
        updatePayload.revision_count = revision_count;
      }

      const { error } = await supabase
        .from("briefing_images")
        .update(updatePayload)
        .eq("id", image_id);

      if (error) throw error;

      // Archive approved delivery as brand asset
      if (status === "completed") {
        const { data: imgData } = await supabase
          .from("briefing_images")
          .select("id, image_type, product_name, briefing_requests!inner(platform_url)")
          .eq("id", image_id)
          .single();

        if (imgData) {
          const platformUrl = (imgData as any).briefing_requests?.platform_url;
          if (platformUrl) {
            const { data: deliveries } = await supabase
              .from("briefing_deliveries")
              .select("file_url")
              .eq("briefing_image_id", image_id)
              .order("created_at", { ascending: false })
              .limit(1);

            if (deliveries && deliveries.length > 0) {
              await supabase.from("brand_assets").insert({
                file_url: deliveries[0].file_url,
                platform_url: platformUrl,
                briefing_image_id: image_id,
                source: "approved_delivery",
                file_name: `${imgData.image_type}${imgData.product_name ? ` — ${imgData.product_name}` : ""}`,
              });
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
