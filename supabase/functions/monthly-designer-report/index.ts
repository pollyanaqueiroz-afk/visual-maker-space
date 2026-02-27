import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine the previous month range
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Allow override via query params for manual trigger / download
    const url = new URL(req.url);
    const paramMonth = url.searchParams.get("month"); // format: YYYY-MM
    let rangeStart = firstDayLastMonth;
    let rangeEnd = firstDayThisMonth;

    if (paramMonth) {
      const [y, m] = paramMonth.split("-").map(Number);
      rangeStart = new Date(y, m - 1, 1);
      rangeEnd = new Date(y, m, 1);
    }

    const rangeStartISO = rangeStart.toISOString();
    const rangeEndISO = rangeEnd.toISOString();

    // Get all completed images with assigned_email in the period
    // We look at briefing_deliveries created_at to know when work was delivered
    const { data: deliveries, error: delError } = await supabase
      .from("briefing_deliveries")
      .select("briefing_image_id, delivered_by_email, created_at")
      .gte("created_at", rangeStartISO)
      .lt("created_at", rangeEndISO);

    if (delError) throw delError;

    if (!deliveries || deliveries.length === 0) {
      // No deliveries — still send a notice
      const monthLabel = rangeStart.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });

      const sendOnly = url.searchParams.get("send") !== "false";

      if (sendOnly) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Curseduca Design <noreply@curseduca.com>",
            to: ["financeiro@curseduca.com"],
            subject: `Relatório Mensal de Designers Externos — ${monthLabel}`,
            html: `<p>Nenhuma entrega registrada no período de <strong>${monthLabel}</strong>.</p>`,
          }),
        });
      }

      return new Response(
        JSON.stringify({ message: "No deliveries", designers: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique image ids
    const imageIds = [...new Set(deliveries.map((d) => d.briefing_image_id))];

    // Fetch image details (price_per_art, assigned_email, image_type, product_name)
    const { data: images, error: imgError } = await supabase
      .from("briefing_images")
      .select("id, assigned_email, price_per_art, image_type, product_name")
      .in("id", imageIds);

    if (imgError) throw imgError;

    const imageMap = new Map((images || []).map((i) => [i.id, i]));

    // Aggregate per designer
    const designerMap: Record<
      string,
      { count: number; total: number; items: { type: string; product: string | null; price: number }[] }
    > = {};

    for (const del of deliveries) {
      const img = imageMap.get(del.briefing_image_id);
      const email = del.delivered_by_email || img?.assigned_email || "desconhecido";
      const price = img?.price_per_art ? Number(img.price_per_art) : 0;

      if (!designerMap[email]) {
        designerMap[email] = { count: 0, total: 0, items: [] };
      }
      designerMap[email].count += 1;
      designerMap[email].total += price;
      designerMap[email].items.push({
        type: img?.image_type || "desconhecido",
        product: img?.product_name || null,
        price,
      });
    }

    const monthLabel = rangeStart.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });

    // Build HTML email
    const designerRows = Object.entries(designerMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(
        ([email, data]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${email}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${data.count}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">R$ ${data.total.toFixed(2)}</td>
        </tr>`
      )
      .join("");

    const grandTotal = Object.values(designerMap).reduce((s, d) => s + d.total, 0);
    const grandCount = Object.values(designerMap).reduce((s, d) => s + d.count, 0);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">Relatório Mensal de Designers Externos</h2>
        <p style="color:#666;">Período: <strong>${monthLabel}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;text-align:left;">Designer</th>
              <th style="padding:8px 12px;text-align:center;">Artes Entregues</th>
              <th style="padding:8px 12px;text-align:right;">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            ${designerRows}
          </tbody>
          <tfoot>
            <tr style="background:#f0f0f0;font-weight:bold;">
              <td style="padding:8px 12px;">TOTAL</td>
              <td style="padding:8px 12px;text-align:center;">${grandCount}</td>
              <td style="padding:8px 12px;text-align:right;">R$ ${grandTotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <p style="color:#999;font-size:12px;margin-top:24px;">Este email foi gerado automaticamente pelo sistema Curseduca Design.</p>
      </div>
    `;

    const sendOnly = url.searchParams.get("send") !== "false";

    if (sendOnly) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Curseduca Design <noreply@curseduca.com>",
          to: ["financeiro@curseduca.com"],
          subject: `Relatório Mensal de Designers Externos — ${monthLabel}`,
          html,
        }),
      });

      console.log("Email sent:", emailRes.status);
    }

    // Return data for download usage
    const designers = Object.entries(designerMap).map(([email, data]) => ({
      email,
      count: data.count,
      total: data.total,
      items: data.items,
    }));

    return new Response(
      JSON.stringify({ message: "Report generated", month: monthLabel, designers, grandTotal, grandCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
