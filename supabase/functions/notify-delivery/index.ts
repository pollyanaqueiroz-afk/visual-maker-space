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
  app_mockup: "Mockup do Aplicativo",
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
    const body = await req.json();
    const image_id = typeof body.image_id === "string" ? body.image_id.trim().slice(0, 100) : "";
    const file_url = typeof body.file_url === "string" ? body.file_url.slice(0, 2000) : null;
    const delivered_by_email = typeof body.delivered_by_email === "string" ? body.delivered_by_email.replace(/<[^>]*>/g, "").trim().slice(0, 255) : null;
    const comments = typeof body.comments === "string" ? body.comments.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, "").slice(0, 2000) : null;
    const app_url = typeof body.app_url === "string" ? body.app_url.slice(0, 500) : null;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!image_id || !uuidRegex.test(image_id)) {
      return new Response(
        JSON.stringify({ error: "image_id must be a valid UUID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch image + request data
    const { data: image, error: imgErr } = await supabase
      .from("briefing_images")
      .select("*, briefing_requests!inner(requester_name, requester_email, platform_url, review_token)")
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
    const appBaseUrl = app_url || Deno.env.get("APP_URL") || "https://app.curseduca.com";
    const reviewUrl = request.review_token
      ? `${appBaseUrl}/client-review?token=${request.review_token}`
      : `${appBaseUrl}/client-review?email=${encodeURIComponent(request.requester_email)}`;

    const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#ffffff;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#2a9d6a,#34b87a);border-radius:16px 16px 0 0;padding:32px 24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">🎨</div>
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Sua arte está pronta!</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Hora de aprovar ou solicitar ajustes</p>
        </div>

        <!-- Body -->
        <div style="padding:28px 24px;">
          <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
            Olá <strong>${request.requester_name}</strong>,
          </p>
          <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
            A arte <strong>${imageTypeLabel}${productLabel}</strong> foi finalizada pelo designer e está aguardando sua aprovação.
            Você pode aprovar com um clique ou solicitar ajustes diretamente pelo nosso painel.
          </p>

          <!-- Info card -->
          <div style="background:#f8faf9;border:1px solid #e8ede9;border-radius:12px;padding:20px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#888;font-size:13px;width:130px;">📌 Tipo</td>
                <td style="padding:8px 0;color:#333;font-size:14px;font-weight:600;">${imageTypeLabel}</td>
              </tr>
              ${image.product_name ? `
              <tr>
                <td style="padding:8px 0;color:#888;font-size:13px;">📦 Produto</td>
                <td style="padding:8px 0;color:#333;font-size:14px;">${image.product_name}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:8px 0;color:#888;font-size:13px;">🎨 Designer</td>
                <td style="padding:8px 0;color:#333;font-size:14px;">${(delivered_by_email || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
              </tr>
              ${comments ? `
              <tr>
                <td style="padding:8px 0;color:#888;font-size:13px;vertical-align:top;">💬 Observação</td>
                <td style="padding:8px 0;color:#333;font-size:14px;">${(comments || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
              </tr>` : ""}
            </table>
          </div>

          <!-- CTA Button -->
          <div style="text-align:center;margin-bottom:16px;">
            <a href="${reviewUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#2a9d6a,#34b87a);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 4px 14px rgba(42,157,106,0.3);">
              ✅ Aprovar ou Revisar Arte
            </a>
          </div>

          <p style="text-align:center;color:#999;font-size:12px;margin:0 0 20px;">
            Clique acima para acessar o painel de validação
          </p>

          ${file_url ? `
          <div style="text-align:center;border-top:1px solid #eee;padding-top:16px;">
            <a href="${file_url}" style="color:#2a9d6a;font-size:13px;text-decoration:underline;">
              📥 Baixar arquivo diretamente
            </a>
          </div>` : ""}
        </div>

        <!-- Footer -->
        <div style="background:#f5f5f5;border-radius:0 0 16px 16px;padding:16px 24px;text-align:center;">
          <p style="margin:0;color:#aaa;font-size:11px;">
            Enviado automaticamente pelo sistema de gestão de artes • Curseduca Design
          </p>
        </div>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("FROM_EMAIL") || "Curseduca <noreply@curseduca.com>",
        to: [request.requester_email],
        subject: `🎨 Sua arte está pronta para aprovação: ${imageTypeLabel}${productLabel}`,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      // Non-blocking: return success with warning
      return new Response(
        JSON.stringify({ success: true, email_warning: "Email sending failed but delivery was recorded", details: resendData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
