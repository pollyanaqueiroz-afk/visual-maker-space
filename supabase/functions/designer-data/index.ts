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
      .select("id, image_type, product_name, deadline, status, revision_count, delivery_token, price_per_art, created_at, briefing_requests!inner(requester_name, platform_url)")
      .eq("assigned_email", cleanEmail)
      .order("created_at", { ascending: false });

    if (imgErr) throw imgErr;

    // Fetch feedbacks (reviews for designer's images)
    const imageIds = (images || []).map((i: any) => i.id);
    let feedbackImages: any[] = [];
    let reviews: any[] = [];

    if (imageIds.length > 0) {
      const [fbResult, revResult] = await Promise.all([
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
      ]);
      feedbackImages = fbResult.data || [];
      reviews = revResult.data || [];
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
