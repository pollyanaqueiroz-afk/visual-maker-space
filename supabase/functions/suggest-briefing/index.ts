import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const currentForm = body.currentForm && typeof body.currentForm === "object" ? body.currentForm : null;

    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce max length
    if (message.length > 10000) {
      return new Response(JSON.stringify({ error: "Mensagem muito grande. Máximo: 10.000 caracteres." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit currentForm serialized size
    const currentFormStr = currentForm ? JSON.stringify(currentForm) : "";
    if (currentFormStr.length > 50000) {
      return new Response(JSON.stringify({ error: "Formulário muito grande." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um assistente de briefing de design para a plataforma Curseduca. O usuário está preenchendo um formulário de solicitação de artes visuais para sua área de membros.

Com base na mensagem do usuário, gere uma sugestão de preenchimento do briefing.

O formulário tem os seguintes campos por imagem:
- image_text: Texto que aparecerá na arte
- font_suggestion: Fonte sugerida (ex: Poppins, Montserrat)
- element_suggestion: Elementos visuais, estilo, descrição do visual desejado
- professional_photo_url: Link da foto do profissional (se aplicável)
- orientation: "horizontal" ou "vertical" (apenas para capas)
- observations: Observações adicionais
- dimension: Dimensão sugerida (ex: "1920x400" para banners, "800x600" para capas)

Tipos de arte disponíveis:
- login: Imagem da área de login
- banner_vitrine: Banner da vitrine principal (1920x400)
- product_cover: Capa de produto/módulo
- trail_banner: Banner de trilha
- challenge_banner: Banner de desafio
- community_banner: Banner de comunidade

${currentForm ? `Dados já preenchidos pelo usuário:\n${JSON.stringify(currentForm, null, 2)}` : ''}

Responda em JSON com a estrutura:
{
  "suggestion_text": "Texto explicando o que você sugere e por quê (em linguagem amigável, curta)",
  "selections": {
    "login_image": true/false,
    "banner_vitrine": true/false,
    "product_covers": true/false,
    "trail_banner": true/false,
    "challenge_banner": true/false,
    "community_banner": true/false
  },
  "has_trail": true/false,
  "has_challenge": true/false,
  "has_community": true/false,
  "images": {
    "login_image": { "image_text": "", "font_suggestion": "", "element_suggestion": "", "observations": "", "dimension": "" },
    "banner_vitrine": [{ "image_text": "", "font_suggestion": "", "element_suggestion": "", "observations": "", "dimension": "1920x400" }],
    "product_covers": [{ "product_name": "", "image_text": "", "font_suggestion": "", "element_suggestion": "", "orientation": "horizontal", "observations": "", "dimension": "800x600" }],
    "trail_banner": { "image_text": "", "font_suggestion": "", "element_suggestion": "", "observations": "", "dimension": "" },
    "challenge_banner": { "image_text": "", "font_suggestion": "", "element_suggestion": "", "observations": "", "dimension": "" },
    "community_banner": { "image_text": "", "font_suggestion": "", "element_suggestion": "", "observations": "", "dimension": "" }
  }
}

Regras:
- Só inclua as seções que fazem sentido com base na descrição do usuário
- Seja criativo e específico nas sugestões de elementos visuais
- Sugira fontes modernas e profissionais
- Se o usuário mencionar cores, estilo ou público-alvo, adapte as sugestões
- Omita arrays vazios e objetos de imagem que não foram solicitados
- Se não souber algo, deixe o campo vazio ao invés de inventar`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-briefing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
