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
    const { image_id, assigned_email, deadline, app_url } = await req.json();

    if (!image_id || !assigned_email) {
      return new Response(
        JSON.stringify({ error: "image_id and assigned_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch image + request data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: image, error: imgErr } = await supabase
      .from("briefing_images")
      .select("*, briefing_requests!inner(requester_name, requester_email, platform_url, brand_drive_link)")
      .eq("id", image_id)
      .single();

    if (imgErr || !image) {
      return new Response(
        JSON.stringify({ error: "Image not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch reference images
    const { data: refs } = await supabase
      .from("briefing_reference_images")
      .select("*")
      .eq("briefing_image_id", image_id);

    const request = image.briefing_requests;
    const deadlineDate = deadline ? new Date(deadline).toLocaleDateString("pt-BR") : "Não definido";
    const imageTypeLabel = IMAGE_TYPE_LABELS[image.image_type] || image.image_type;

    // Build email HTML
    const pricePerArt = image.price_per_art;

    const detailRows = [
      { label: "Tipo de Arte", value: imageTypeLabel },
      image.product_name && { label: "Produto", value: image.product_name },
      { label: "Cliente (URL)", value: `<a href="${request.platform_url}">${request.platform_url}</a>` },
      { label: "Solicitante", value: `${request.requester_name} (${request.requester_email})` },
      { label: "Prazo de Entrega", value: `<strong>${deadlineDate}</strong>` },
      pricePerArt && { label: "Valor por Arte", value: `<strong>R$ ${Number(pricePerArt).toFixed(2)}</strong>` },
      image.image_text && { label: "Texto da Imagem", value: image.image_text },
      image.font_suggestion && { label: "Sugestão de Fonte", value: image.font_suggestion },
      image.element_suggestion && { label: "Sugestão de Elemento", value: image.element_suggestion },
      image.professional_photo_url && { label: "Foto Profissional", value: `<a href="${image.professional_photo_url}">${image.professional_photo_url}</a>` },
      image.orientation && { label: "Orientação", value: image.orientation },
      image.observations && { label: "Observações", value: image.observations },
      request.brand_drive_link && { label: "Identidade Visual", value: `<a href="${request.brand_drive_link}">${request.brand_drive_link}</a>` },
    ].filter(Boolean);

    const refsHtml = refs && refs.length > 0
      ? `<h3 style="margin-top:24px;color:#333;">Imagens de Referência</h3>
         <div style="display:flex;gap:12px;flex-wrap:wrap;">
           ${refs.map((r: any) => `
             <div style="text-align:center;">
               <img src="${r.file_url}" alt="Referência" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #ddd;" />
               <p style="font-size:12px;color:${r.is_exact_use ? '#16a34a' : '#888'};margin:4px 0;">
                 ${r.is_exact_use ? '✅ Usar exatamente' : 'Referência'}
               </p>
             </div>
           `).join("")}
         </div>`
      : "";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:24px;">
          <h1 style="color:#333;margin:0 0 4px;">📋 Novo Briefing de Design</h1>
          <p style="color:#666;margin:0;">Curseduca — ${imageTypeLabel}</p>
        </div>
        
        <table style="width:100%;border-collapse:collapse;">
          ${detailRows.map((r: any) => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;width:140px;vertical-align:top;">${r.label}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#333;font-size:14px;">${r.value}</td>
            </tr>
          `).join("")}
        </table>

        ${refsHtml}
        
        <div style="margin-top:32px;padding:16px;background:#fff8e1;border-radius:8px;border:1px solid #ffe082;">
          <p style="margin:0;color:#f57c00;font-size:14px;">⏰ <strong>Prazo: ${deadlineDate}</strong></p>
        </div>

        <div style="margin-top:24px;text-align:center;">
          <a href="DELIVERY_LINK_PLACEHOLDER" style="display:inline-block;padding:14px 32px;background:#2a9d6a;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;">
            📤 Entregar Arte
          </a>
          <p style="margin-top:8px;color:#999;font-size:12px;">Use este botão para fazer upload da arte finalizada</p>
        </div>

        <div style="margin-top:16px;text-align:center;">
          <a href="DESIGNER_PANEL_PLACEHOLDER" style="color:#2a9d6a;font-size:13px;text-decoration:underline;">
            📋 Ver todas as minhas artes
          </a>
        </div>

        <p style="margin-top:24px;color:#999;font-size:12px;">
          Este email foi enviado automaticamente pelo sistema de gestão de briefings da Curseduca.
        </p>
      </div>
    `;

    // Generate delivery token and update image
    const deliveryToken = crypto.randomUUID();
    await supabase
      .from("briefing_images")
      .update({ assigned_email, deadline, delivery_token: deliveryToken } as any)
      .eq("id", image_id);

    // Replace delivery link placeholder
    const baseUrl = app_url || "https://id-preview--47593e69-3789-4cdb-b901-66106c2c2f6d.lovable.app";
    const finalHtml = html
      .replace("DELIVERY_LINK_PLACEHOLDER", `${baseUrl}/delivery/${deliveryToken}`)
      .replace("DESIGNER_PANEL_PLACEHOLDER", `${baseUrl}/designer`);

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Curseduca Design <onboarding@resend.dev>",
        to: [assigned_email],
        subject: `📋 Briefing: ${imageTypeLabel}${image.product_name ? ` — ${image.product_name}` : ""} | Prazo: ${deadlineDate}`,
        html: finalHtml,
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
