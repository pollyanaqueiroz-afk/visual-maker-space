import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const IMAGE_TYPE_LABELS: Record<string, string> = {
  login: "Área de Login",
  banner_vitrine: "Banner Vitrine Principal",
  product_cover: "Capa de Produto",
  trail_banner: "Banner de Trilha",
  challenge_banner: "Banner de Desafio",
  community_banner: "Banner de Comunidade",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { image_id, file_url, delivered_by_email, comments, app_url } = await req.json();

    if (!image_id) {
      return new Response(
        JSON.stringify({ error: "image_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch image + request data
    const { data: image, error: imgErr } = await supabase
      .from("briefing_images")
      .select("*, briefing_requests!inner(requester_name, requester_email, platform_url)")
      .eq("id", image_id)
      .single();

    if (imgErr || !image) {
      return new Response(
        JSON.stringify({ error: "Image not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const request = image.briefing_requests;
    const imageTypeLabel = IMAGE_TYPE_LABELS[image.image_type] || image.image_type;
    const productLabel = image.product_name ? ` — ${image.product_name}` : "";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#e8f5e9;border-radius:12px;padding:24px;margin-bottom:24px;">
          <h1 style="color:#2e7d32;margin:0 0 4px;">✅ Arte Entregue!</h1>
          <p style="color:#666;margin:0;">${imageTypeLabel}${productLabel}</p>
        </div>

        <p style="color:#333;font-size:14px;">
          Olá <strong>${request.requester_name}</strong>,
        </p>
        <p style="color:#333;font-size:14px;">
          O designer <strong>${delivered_by_email}</strong> entregou a arte solicitada. 
          A imagem está aguardando sua validação.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;width:140px;">Tipo de Arte</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-size:14px;">${imageTypeLabel}</td>
          </tr>
          ${image.product_name ? `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;">Produto</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-size:14px;">${image.product_name}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;">Designer</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-size:14px;">${delivered_by_email}</td>
          </tr>
          ${comments ? `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;">Comentários</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-size:14px;">${comments}</td>
          </tr>` : ""}
        </table>

        <div style="margin-top:24px;text-align:center;">
          <a href="${file_url}" style="display:inline-block;padding:14px 32px;background:#1976d2;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;">
            📥 Baixar Arte
          </a>
        </div>

        <div style="margin-top:16px;text-align:center;">
          <a href="${app_url || 'https://visual-maker-space.lovable.app'}/client-review?email=${encodeURIComponent(request.requester_email)}" style="display:inline-block;padding:12px 28px;background:#2a9d6a;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">
            ✅ Aprovar ou Solicitar Refação
          </a>
          <p style="margin-top:8px;color:#999;font-size:12px;">Acesse o painel para aprovar ou solicitar ajustes</p>
        </div>

        <p style="margin-top:24px;color:#999;font-size:12px;">
          Este email foi enviado automaticamente pelo sistema de gestão de briefings da Curseduca.
        </p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Curseduca Design <onboarding@resend.dev>",
        to: [request.requester_email],
        subject: `✅ Arte Entregue: ${imageTypeLabel}${productLabel}`,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, email_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
