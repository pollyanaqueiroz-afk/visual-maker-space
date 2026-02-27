import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { image_id, reviewer_comments, reviewed_by, app_url } = await req.json();

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
      .select("*, briefing_requests!inner(requester_name, platform_url)")
      .eq("id", image_id)
      .single();

    if (imgErr || !image) {
      return new Response(
        JSON.stringify({ error: "Image not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!image.assigned_email) {
      return new Response(
        JSON.stringify({ error: "No designer assigned to this image" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const request = image.briefing_requests;
    const imageTypeLabel = IMAGE_TYPE_LABELS[image.image_type] || image.image_type;
    const productLabel = image.product_name ? ` — ${image.product_name}` : "";
    const revisionNumber = image.revision_count || 1;
    const baseUrl = app_url || "https://id-preview--47593e69-3789-4cdb-b901-66106c2c2f6d.lovable.app";
    const deliveryLink = image.delivery_token ? `${baseUrl}/delivery/${image.delivery_token}` : `${baseUrl}/designer`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#fff3e0;border-radius:12px;padding:24px;margin-bottom:24px;">
          <h1 style="color:#e65100;margin:0 0 4px;">🔄 Refação Solicitada</h1>
          <p style="color:#666;margin:0;">${imageTypeLabel}${productLabel}</p>
        </div>

        <p style="color:#333;font-size:14px;">
          Olá, a arte <strong>${imageTypeLabel}${productLabel}</strong> do cliente 
          <strong>${request.requester_name}</strong> precisa de ajustes.
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
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;">Cliente</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-size:14px;">
              <a href="${request.platform_url}" style="color:#1976d2;">${request.platform_url}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;">Nº da Refação</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#e65100;font-size:14px;font-weight:bold;">${revisionNumber}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;">Revisor</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-size:14px;">${reviewed_by || "—"}</td>
          </tr>
        </table>

        ${reviewer_comments ? `
        <div style="margin:20px 0;padding:16px;background:#fce4ec;border-radius:8px;border-left:4px solid #e65100;">
          <p style="margin:0 0 4px;color:#888;font-size:12px;font-weight:bold;">COMENTÁRIOS DO REVISOR</p>
          <p style="margin:0;color:#333;font-size:14px;white-space:pre-wrap;">${reviewer_comments}</p>
        </div>` : ""}

        <div style="margin-top:32px;text-align:center;">
          <a href="${deliveryLink}" style="display:inline-block;padding:14px 32px;background:#e65100;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;">
            📤 Reenviar Arte Corrigida
          </a>
          <p style="margin-top:8px;color:#999;font-size:12px;">Clique para fazer upload da nova versão</p>
        </div>

        <div style="margin-top:16px;text-align:center;">
          <a href="${baseUrl}/designer" style="color:#2a9d6a;font-size:13px;text-decoration:underline;">
            📋 Ver todas as minhas artes
          </a>
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
        to: [image.assigned_email],
        subject: `🔄 Refação ${revisionNumber}: ${imageTypeLabel}${productLabel}`,
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
