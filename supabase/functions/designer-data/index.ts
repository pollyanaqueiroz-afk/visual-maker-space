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
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch images assigned to this designer
    const { data: images, error: imgErr } = await supabase
      .from("briefing_images")
      .select("id, image_type, product_name, deadline, status, revision_count, delivery_token, price_per_art, created_at, request_id, extra_info, image_text, font_suggestion, element_suggestion, orientation, observations, professional_photo_url, briefing_requests!inner(requester_name, platform_url)")
      .eq("assigned_email", cleanEmail)
      .order("created_at", { ascending: false });

    if (imgErr) throw imgErr;

    const imageIds = (images || []).map((i: any) => i.id);
    let feedbackImages: any[] = [];
    let reviews: any[] = [];
    let referenceImages: any[] = [];

    if (imageIds.length > 0) {
      const [fbResult, revResult, refResult] = await Promise.all([
        supabase
          .from("briefing_images")
          .select("id, image_type, product_name, briefing_requests!inner(requester_name)")
          .in("id", imageIds),
        supabase
          .from("briefing_reviews")
          .select("id, action, reviewer_comments, reviewed_by, created_at, briefing_image_id")
          .in("briefing_image_id", imageIds)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("briefing_reference_images")
          .select("id, briefing_image_id, file_url, is_exact_use")
          .in("briefing_image_id", imageIds),
      ]);
      feedbackImages = fbResult.data || [];
      reviews = revResult.data || [];
      referenceImages = refResult.data || [];
    }

    // Fetch brand assets for the platform URLs the designer works with
    const platformUrls = [...new Set((images || []).map((i: any) => i.briefing_requests?.platform_url).filter(Boolean))];
    let brandAssets: any[] = [];
    if (platformUrls.length > 0) {
      const { data: assets } = await supabase
        .from("brand_assets")
        .select("id, file_url, file_name, platform_url")
        .in("platform_url", platformUrls);
      brandAssets = assets || [];
    }

    // Fetch adjustment briefings assigned to this designer
    const { data: adjustments } = await supabase
      .from("briefing_adjustments")
      .select("id, client_url, client_email, status, deadline, assigned_email, created_at")
      .eq("assigned_email", cleanEmail)
      .in("status", ["allocated", "in_progress", "revision"])
      .order("created_at", { ascending: false });

    let adjustmentItems: any[] = [];
    if (adjustments && adjustments.length > 0) {
      const adjIds = adjustments.map((a: any) => a.id);
      const { data: items } = await supabase
        .from("briefing_adjustment_items")
        .select("id, adjustment_id, file_url, file_name, observations")
        .in("adjustment_id", adjIds);
      adjustmentItems = items || [];
    }

    // Fetch analytics data
    const { data: deliveries } = await supabase
      .from("briefing_deliveries")
      .select("briefing_image_id, created_at")
      .eq("delivered_by_email", cleanEmail)
      .order("created_at", { ascending: true });

    return new Response(
      JSON.stringify({
        images: images || [],
        feedbackImages,
        reviews,
        referenceImages,
        brandAssets,
        adjustments: adjustments || [],
        adjustmentItems,
        deliveries: deliveries || [],
      }),
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
