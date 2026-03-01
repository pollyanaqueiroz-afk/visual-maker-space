import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      dealId,
      dealName,
      contactEmail,
      contactName,
      contactPhone,
      planoPrincipal,
      temApp,
      closeDate,
    } = body;

    // Check if deal includes app
    const plansWithApp = ["Evolution APP", "Pro", "Black", "Enterprise"];
    const shouldCreateApp = temApp === "true" || temApp === true || plansWithApp.some(p => planoPrincipal?.includes(p));

    if (!shouldCreateApp) {
      return new Response(
        JSON.stringify({ ok: true, message: "Deal does not include app, skipping." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client
    const { data: cliente, error } = await supabase.from("app_clientes").insert({
      nome: contactName || dealName || "Cliente",
      empresa: dealName || "Empresa",
      email: contactEmail || "",
      whatsapp: contactPhone || null,
      plataforma: "ambos",
      hubspot_deal_id: dealId?.toString() || null,
      prazo_estimado: closeDate || null,
    }).select("id, portal_token").single();

    if (error) throw error;

    // Send welcome notification
    await supabase.from("app_notificacoes").insert({
      cliente_id: cliente.id,
      tipo: "lembrete_acao",
      canal: "email",
      destinatario: contactEmail,
      titulo: "🚀 Bem-vindo à esteira de aplicativo!",
      mensagem: `Olá ${contactName}! Seu processo de publicação do app começou. Acesse o portal para dar os primeiros passos.`,
      agendado_para: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        clienteId: cliente.id,
        portalToken: cliente.portal_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
