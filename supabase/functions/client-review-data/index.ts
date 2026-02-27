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
    const review_token = typeof body.review_token === "string" ? body.review_token.trim().slice(0, 100) : "";
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 255) : "";
    const image_id = typeof body.image_id === "string" ? body.image_id.trim().slice(0, 100) : "";

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let requests: any[] = [];

    // Prefer token-based auth (secure), fall back to email (manual login)
    if (review_token) {
      if (!uuidRegex.test(review_token)) {
        return new Response(
          JSON.stringify({ error: "Token inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: tokenRequests, error: tErr } = await supabase
        .from("briefing_requests")
        .select("id, requester_name, platform_url, requester_email")
        .eq("review_token", review_token);

      if (tErr) throw tErr;
      if (!tokenRequests || tokenRequests.length === 0) {
        return new Response(
          JSON.stringify({ error: "Token não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      requests = tokenRequests;
    } else if (email) {
      // Email-based login (manual form entry)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email) || email.length > 255) {
        return new Response(
          JSON.stringify({ error: "Email inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanEmail = email.trim().toLowerCase();
      const { data: emailRequests, error: reqErr } = await supabase
        .from("briefing_requests")
        .select("id, requester_name, platform_url")
        .eq("requester_email", cleanEmail);

      if (reqErr) throw reqErr;
      requests = emailRequests || [];
    } else {
      return new Response(
        JSON.stringify({ error: "review_token ou email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (requests.length === 0) {
      return new Response(
        JSON.stringify({ requests: [], images: { review: [], production: [], all: [] }, counts: { pending: 0, completed: 0, total: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the email from token-based auth so client can use it for reviews
    const resolvedEmail = requests[0]?.requester_email || email;

    const requestIds = requests.map((r) => r.id);

    // 2. Fetch all image data in parallel
    const [reviewResult, pendingResult, completedResult, totalResult, prodResult, allResult] = await Promise.all([
      supabase
        .from("briefing_images")
        .select("id, image_type, product_name, assigned_email, revision_count, request_id, briefing_requests!inner(requester_name, platform_url)")
        .in("request_id", requestIds)
        .eq("status", "review")
        .order("created_at", { ascending: true }),
      supabase
        .from("briefing_images")
        .select("id", { count: "exact", head: true })
        .in("request_id", requestIds)
        .in("status", ["pending", "in_progress"]),
      supabase
        .from("briefing_images")
        .select("id", { count: "exact", head: true })
        .in("request_id", requestIds)
        .eq("status", "completed"),
      supabase
        .from("briefing_images")
        .select("id", { count: "exact", head: true })
        .in("request_id", requestIds),
      supabase
        .from("briefing_images")
        .select("id, image_type, product_name, deadline, assigned_email, status")
        .in("request_id", requestIds)
        .in("status", ["pending", "in_progress"])
        .order("deadline", { ascending: true, nullsFirst: false }),
      supabase
        .from("briefing_images")
        .select("id, image_type, product_name, deadline, assigned_email, status, image_text, observations, font_suggestion, element_suggestion, orientation, revision_count, created_at")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false }),
    ]);

    // 3. Fetch deliveries for review images
    const reviewImages = reviewResult.data || [];
    const imagesWithDelivery = [];

    for (const img of reviewImages) {
      const { data: deliveries } = await supabase
        .from("briefing_deliveries")
        .select("file_url, comments, created_at")
        .eq("briefing_image_id", img.id)
        .order("created_at", { ascending: false })
        .limit(1);

      imagesWithDelivery.push({
        ...img,
        delivery: deliveries && deliveries.length > 0 ? deliveries[0] : null,
      });
    }

    // 4. Fetch review history using resolved email
    const { data: reviewHistory } = await supabase
      .from("briefing_reviews")
      .select("id, action, reviewer_comments, created_at, briefing_image_id")
      .eq("reviewed_by", resolvedEmail.trim().toLowerCase())
      .order("created_at", { ascending: true })
      .limit(200);

    return new Response(
      JSON.stringify({
        requests,
        resolvedEmail: resolvedEmail.trim().toLowerCase(),
        images: {
          review: imagesWithDelivery,
          production: prodResult.data || [],
          all: allResult.data || [],
        },
        counts: {
          pending: pendingResult.count || 0,
          completed: completedResult.count || 0,
          total: totalResult.count || 0,
        },
        reviewHistory: reviewHistory || [],
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
