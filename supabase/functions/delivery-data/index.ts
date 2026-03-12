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
    const reviewed_by = typeof body.reviewed_by === "string" ? body.reviewed_by.replace(/<[^>]*>/g, "").trim().slice(0, 255) : "";
    const reviewer_comments = typeof body.reviewer_comments === "string" ? body.reviewer_comments.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").slice(0, 2000) : "";

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
        .select("id, image_type, product_name, image_text, deadline, assigned_email, status, observations, orientation, font_suggestion, element_suggestion, professional_photo_url, extra_info, briefing_requests!inner(requester_name, platform_url)")
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

      // Notify client by email that art is ready for review
      try {
        const { data: imgData } = await supabase
          .from("briefing_images")
          .select("image_type, product_name, observations, briefing_requests!inner(requester_name, requester_email, platform_url, review_token)")
          .eq("id", image_id)
          .single();

        if (imgData) {
          const req = (imgData as any).briefing_requests;
          const requesterEmail = req?.requester_email;
          const requesterName = req?.requester_name;
          const reviewToken = req?.review_token;

          if (requesterEmail) {
            const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
            if (RESEND_API_KEY) {
              const imageTypeLabel: Record<string, string> = {
                login: "Área de Login",
                banner_vitrine: "Banner Vitrine",
                product_cover: "Capa de Produto",
                trail_banner: "Banner de Trilha",
                challenge_banner: "Banner de Desafio",
                community_banner: "Banner de Comunidade",
                app_mockup: "Mockup do Aplicativo",
              };
              const arteName = imageTypeLabel[imgData.image_type] || imgData.image_type;
              const arteDetail = imgData.observations || imgData.product_name || "";
              const baseUrl = Deno.env.get("APP_URL") || "https://app.curseduca.com";
              const reviewUrl = reviewToken
                ? `${baseUrl}/client-review?token=${reviewToken}`
                : `${baseUrl}/client-review?email=${encodeURIComponent(requesterEmail)}`;

              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "Curseduca Design <noreply@curseduca.com>",
                  to: [requesterEmail],
                  subject: `🎨 Arte pronta para sua aprovação — ${arteName}${arteDetail ? ` (${arteDetail})` : ""}`,
                  html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
                    <h2 style="color:#7c3aed;margin-bottom:8px">🎨 Arte pronta!</h2>
                    <p style="color:#555;font-size:15px">Olá ${requesterName?.split(" ")[0] || ""}! A arte <strong>${arteName}</strong>${arteDetail ? " — " + arteDetail : ""} foi finalizada e está aguardando sua aprovação.</p>
                    <a href="${reviewUrl}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Revisar e Aprovar →</a>
                    <p style="color:#999;font-size:13px">Você pode aprovar ou solicitar ajustes diretamente pelo link acima.</p>
                  </div>`,
                }),
              });
            }
          }
        }
      } catch (emailErr) {
        console.error("Failed to send review notification email:", emailErr);
      }

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

      // Insert review record if reviewed_by is provided
      if (reviewed_by) {
        const reviewAction = status === "completed" ? "approved" : status === "in_progress" ? "revision_requested" : status;
        await supabase.from("briefing_reviews").insert({
          briefing_image_id: image_id,
          action: reviewAction,
          reviewed_by,
          reviewer_comments: reviewer_comments || null,
        });
      }

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
              try {
                await supabase.from("brand_assets").insert({
                  file_url: deliveries[0].file_url,
                  platform_url: platformUrl,
                  briefing_image_id: image_id,
                  source: "approved_delivery",
                  file_name: `${imgData.image_type}${imgData.product_name ? ` — ${imgData.product_name}` : ""}`,
                });
              } catch (assetErr) {
                // Ignore duplicate - idempotent operation
                console.log("Brand asset already exists or insert failed:", assetErr);
              }
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SUBMIT_ADJUSTMENT: Deliver adjusted art for an adjustment briefing
    if (action === "submit_adjustment") {
      const adjustment_id = typeof body.adjustment_id === "string" ? body.adjustment_id.trim().slice(0, 100) : "";
      if (!adjustment_id || !uuidRegex.test(adjustment_id)) {
        return new Response(
          JSON.stringify({ error: "adjustment_id must be a valid UUID" }),
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

      // Update adjustment with delivery info
      const { error: updateErr } = await supabase
        .from("briefing_adjustments")
        .update({
          delivery_url: file_url,
          delivery_comments: comments || null,
          delivered_by: delivered_by_email,
          delivered_at: new Date().toISOString(),
          status: "review",
        })
        .eq("id", adjustment_id);

      if (updateErr) throw updateErr;

      // If linked to a briefing image, create a revision record and increment revision_count
      try {
        const { data: adjLink } = await supabase
          .from("briefing_adjustments")
          .select("source_briefing_image_id, client_email")
          .eq("id", adjustment_id)
          .single();

        if (adjLink?.source_briefing_image_id) {
          // Increment revision count on the linked briefing image
          const { data: imgData } = await supabase
            .from("briefing_images")
            .select("revision_count")
            .eq("id", adjLink.source_briefing_image_id)
            .single();

          if (imgData) {
            await supabase
              .from("briefing_images")
              .update({ 
                revision_count: (imgData.revision_count || 0) + 1,
                status: "in_progress"
              })
              .eq("id", adjLink.source_briefing_image_id);

            // Create a briefing_review record to track this as a refação
            await supabase.from("briefing_reviews").insert({
              briefing_image_id: adjLink.source_briefing_image_id,
              action: "revision_requested",
              reviewed_by: adjLink.client_email || "ajuste-briefing",
              reviewer_comments: `Ajuste de briefing entregue (ID: ${adjustment_id.slice(0, 8)})`,
            });
          }
        }
      } catch (linkErr) {
        console.error("Failed to link adjustment to briefing image:", linkErr);
      }

      // Send email notification to requester
      try {
        const { data: adjData } = await supabase
          .from("briefing_adjustments")
          .select("client_email, client_url")
          .eq("id", adjustment_id)
          .single();

        if (adjData?.client_email) {
          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
          if (RESEND_API_KEY) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Curseduca Design <noreply@curseduca.com>",
                to: [adjData.client_email],
                subject: `🎨 Ajuste de arte concluído — ${adjData.client_url || ""}`,
                html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
                  <h2 style="color:#7c3aed;margin-bottom:8px">🎨 Ajuste concluído!</h2>
                  <p style="color:#555;font-size:15px">O ajuste solicitado para <strong>${adjData.client_url || "seu briefing"}</strong> foi finalizado e está disponível para revisão.</p>
                  <p style="color:#999;font-size:13px;margin-top:16px">Acesse o Hub para revisar a entrega.</p>
                </div>`,
              }),
            });
          }
        }
      } catch (emailErr) {
        console.error("Failed to send adjustment delivery email:", emailErr);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // RESEND_ADJUSTMENT_NOTIFICATION: Resend email to client about delivered adjustment
    if (action === "resend_adjustment_notification") {
      const adjustment_id = typeof body.adjustment_id === "string" ? body.adjustment_id.trim().slice(0, 100) : "";
      if (!adjustment_id || !uuidRegex.test(adjustment_id)) {
        return new Response(
          JSON.stringify({ error: "adjustment_id must be a valid UUID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: adjData } = await supabase
        .from("briefing_adjustments")
        .select("client_email, client_url, delivery_url")
        .eq("id", adjustment_id)
        .single();

      if (!adjData?.client_email) {
        return new Response(
          JSON.stringify({ error: "Adjustment not found or no client email" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Curseduca Design <noreply@curseduca.com>",
            to: [adjData.client_email],
            subject: `🎨 Ajuste de arte concluído — ${adjData.client_url || ""}`,
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">🎨 Ajuste concluído!</h2>
              <p style="color:#555;font-size:15px">O ajuste solicitado para <strong>${adjData.client_url || "seu briefing"}</strong> foi finalizado e está disponível para revisão.</p>
              ${adjData.delivery_url ? `<a href="${adjData.delivery_url}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Visualizar Arte →</a>` : ''}
              <p style="color:#999;font-size:13px;margin-top:16px">Acesse o link acima para revisar a entrega.</p>
            </div>`,
          }),
        });
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
