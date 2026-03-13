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

async function logEmail(supabase: any, params: {
  recipient_email: string;
  client_name?: string;
  client_url?: string;
  subject: string;
  html_body: string;
  send_type: string;
  origin: string;
  sender_name?: string;
  status: string;
  resend_id?: string;
  error_message?: string;
}) {
  try {
    await supabase.from("email_logs").insert({
      sender_name: params.sender_name || null,
      sender_type: params.send_type === "automatic" ? "system" : "user",
      recipient_email: params.recipient_email,
      client_name: params.client_name || null,
      client_url: params.client_url || null,
      subject: params.subject,
      html_body: params.html_body?.slice(0, 50000) || null,
      send_type: params.send_type,
      origin: params.origin,
      status: params.status,
      resend_id: params.resend_id || null,
      error_message: params.error_message || null,
    });
  } catch (e) {
    console.error("Failed to log email:", e);
  }
}

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();

    // === BULK DELIVERY NOTIFICATION ===
    if (body.client_email && body.delivery_links) {
      const clientEmail = typeof body.client_email === "string" ? body.client_email.replace(/<[^>]*>/g, "").trim().slice(0, 255) : "";
      const clientName = typeof body.client_name === "string" ? body.client_name.replace(/<[^>]*>/g, "").trim().slice(0, 255) : "Cliente";
      const platformUrl = typeof body.platform_url === "string" ? body.platform_url.slice(0, 500) : "";
      const deliveryLinks: string[] = Array.isArray(body.delivery_links) ? body.delivery_links.filter((l: any) => typeof l === "string").slice(0, 50) : [];

      if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        return new Response(
          JSON.stringify({ error: "E-mail do cliente inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const linksHtml = deliveryLinks.map((link: string, i: number) =>
        `<tr><td style="padding:6px 0;"><a href="${link}" style="color:#2a9d6a;font-size:13px;text-decoration:underline;">📥 Arte ${i + 1}</a></td></tr>`
      ).join("");

      const subject = `🎨 Suas artes estão prontas — ${clientName}`;
      const bulkHtml = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#ffffff;">
          <div style="background:linear-gradient(135deg,#2a9d6a,#34b87a);border-radius:16px 16px 0 0;padding:32px 24px;text-align:center;">
            <div style="font-size:48px;margin-bottom:8px;">🎨</div>
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Suas artes estão prontas!</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${deliveryLinks.length} arte(s) disponíveis para visualização</p>
          </div>
          <div style="padding:28px 24px;">
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">
              Olá <strong>${clientName}</strong>,
            </p>
            <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
              Suas artes foram finalizadas e estão disponíveis para visualização e download. Confira os links abaixo:
            </p>
            <div style="background:#f8faf9;border:1px solid #e8ede9;border-radius:12px;padding:20px;margin-bottom:24px;">
              <table style="width:100%;border-collapse:collapse;">${linksHtml}</table>
            </div>
            <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 16px;">
              Acesse seu portal utilizando sua URL da CurseEduca para visualizar e validar os materiais.
            </p>
            <p style="color:#999;font-size:12px;margin:0;">Qualquer dúvida, entre em contato conosco.</p>
          </div>
          <div style="background:#f5f5f5;border-radius:0 0 16px 16px;padding:16px 24px;text-align:center;">
            <p style="margin:0;color:#aaa;font-size:11px;">Enviado automaticamente pelo sistema de gestão de artes • Curseduca Design</p>
          </div>
        </div>
      `;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("FROM_EMAIL") || "Curseduca <noreply@curseduca.com>",
          to: [clientEmail],
          subject,
          html: bulkHtml,
        }),
      });

      const resendData = await resendRes.json();

      await logEmail(supabase, {
        recipient_email: clientEmail,
        client_name: clientName,
        client_url: platformUrl,
        subject,
        html_body: bulkHtml,
        send_type: body.send_type || "automatic",
        origin: body.origin || "delivery",
        sender_name: body.sender_name || null,
        status: resendRes.ok ? "sent" : "failed",
        resend_id: resendData?.id,
        error_message: resendRes.ok ? undefined : JSON.stringify(resendData),
      });

      if (!resendRes.ok) {
        console.error("Resend error:", resendData);
        return new Response(
          JSON.stringify({ success: true, email_warning: "Email sending failed", details: resendData }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, email_id: resendData.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === SINGLE IMAGE NOTIFICATION ===
    const image_id = typeof body.image_id === "string" ? body.image_id.trim().slice(0, 100) : "";
    const file_url = typeof body.file_url === "string" ? body.file_url.slice(0, 2000) : null;
    const delivered_by_email = typeof body.delivered_by_email === "string" ? body.delivered_by_email.replace(/<[^>]*>/g, "").trim().slice(0, 255) : null;
    const comments = typeof body.comments === "string" ? body.comments.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, "").slice(0, 2000) : null;
    const app_url = typeof body.app_url === "string" ? body.app_url.slice(0, 500) : null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!image_id || !uuidRegex.test(image_id)) {
      return new Response(
        JSON.stringify({ error: "image_id must be a valid UUID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const subject = `🎨 Sua arte está pronta para aprovação: ${imageTypeLabel}${productLabel}`;
    const html = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#ffffff;">
        <div style="background:linear-gradient(135deg,#2a9d6a,#34b87a);border-radius:16px 16px 0 0;padding:32px 24px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">🎨</div>
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Sua arte está pronta!</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Hora de aprovar ou solicitar ajustes</p>
        </div>
        <div style="padding:28px 24px;">
          <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 20px;">Olá <strong>${request.requester_name}</strong>,</p>
          <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px;">
            A arte <strong>${imageTypeLabel}${productLabel}</strong> foi finalizada pelo designer e está aguardando sua aprovação.
          </p>
          <div style="background:#f8faf9;border:1px solid #e8ede9;border-radius:12px;padding:20px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#888;font-size:13px;width:130px;">📌 Tipo</td><td style="padding:8px 0;color:#333;font-size:14px;font-weight:600;">${imageTypeLabel}</td></tr>
              ${image.product_name ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">📦 Produto</td><td style="padding:8px 0;color:#333;font-size:14px;">${image.product_name}</td></tr>` : ""}
              <tr><td style="padding:8px 0;color:#888;font-size:13px;">🎨 Designer</td><td style="padding:8px 0;color:#333;font-size:14px;">${(delivered_by_email || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td></tr>
              ${comments ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;vertical-align:top;">💬 Observação</td><td style="padding:8px 0;color:#333;font-size:14px;">${(comments || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td></tr>` : ""}
            </table>
          </div>
          <div style="text-align:center;margin-bottom:16px;">
            <a href="${reviewUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#2a9d6a,#34b87a);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 4px 14px rgba(42,157,106,0.3);">✅ Aprovar ou Revisar Arte</a>
          </div>
          <p style="text-align:center;color:#999;font-size:12px;margin:0 0 20px;">Acesse seu portal utilizando sua URL da CurseEduca para validar.</p>
          ${file_url ? `<div style="text-align:center;border-top:1px solid #eee;padding-top:16px;"><a href="${file_url}" style="color:#2a9d6a;font-size:13px;text-decoration:underline;">📥 Baixar arquivo diretamente</a></div>` : ""}
        </div>
        <div style="background:#f5f5f5;border-radius:0 0 16px 16px;padding:16px 24px;text-align:center;">
          <p style="margin:0;color:#aaa;font-size:11px;">Enviado automaticamente pelo sistema de gestão de artes • Curseduca Design</p>
        </div>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("FROM_EMAIL") || "Curseduca <noreply@curseduca.com>",
        to: [request.requester_email],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    await logEmail(supabase, {
      recipient_email: request.requester_email,
      client_name: request.requester_name,
      client_url: request.platform_url,
      subject,
      html_body: html,
      send_type: "automatic",
      origin: "delivery",
      sender_name: delivered_by_email || null,
      status: resendRes.ok ? "sent" : "failed",
      resend_id: resendData?.id,
      error_message: resendRes.ok ? undefined : JSON.stringify(resendData),
    });

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
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
