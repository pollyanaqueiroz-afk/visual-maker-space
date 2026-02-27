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
    const documentText = typeof body.documentText === "string" ? body.documentText.trim() : "";

    if (!documentText) {
      return new Response(JSON.stringify({ error: "documentText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce max length to prevent resource exhaustion
    if (documentText.length > 100000) {
      return new Response(JSON.stringify({ error: "Documento muito grande. Máximo: 100.000 caracteres." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um extrator de dados de documentos de briefing de design da plataforma Curseduca.
Analise o texto do documento e extraia os dados estruturados.

Retorne EXATAMENTE no formato JSON abaixo. Se um campo não estiver preenchido, use string vazia "".
Para image_type use: "login", "banner_vitrine", "product_cover", "trail_banner", "challenge_banner", "community_banner".

{
  "platform_url": "URL da plataforma",
  "brand_drive_link": "link do Google Drive da identidade visual",
  "has_trail": false,
  "has_challenge": false,
  "has_community": false,
  "images": [
    {
      "image_type": "login",
      "product_name": "",
      "image_text": "texto da imagem",
      "font_suggestion": "fonte sugerida",
      "element_suggestion": "elemento ou imagem sugerida",
      "professional_photo_url": "link da foto do profissional",
      "orientation": "horizontal ou vertical (só para capas)",
      "observations": "observações adicionais",
      "extra_info": "outras informações relevantes não cobertas pelos campos acima"
    }
  ]
}

Regras:
- Extraia TODAS as imagens mencionadas no documento
- Para capas de produto, crie uma entrada para cada produto/módulo listado na tabela
- Se mencionar trilha, defina has_trail=true. Se mencionar desafio, has_challenge=true. Se comunidade, has_community=true.
- Inclua banner de trilha/desafio/comunidade como imagens separadas se preenchidos
- Banners da vitrine principal devem ter image_type "banner_vitrine"
- Não inclua seções que estejam completamente vazias (sem nenhum campo preenchido)
- O campo "extra_info" deve conter APENAS informações úteis para o designer que NÃO estejam já nos outros campos (ex: paleta de cores específica, estilo visual, público-alvo, tom de comunicação, referências de marca, instruções especiais). NÃO repita informações já presentes nos outros campos. Se não houver info extra relevante, use "".`;


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
          { role: "user", content: `Extraia os dados deste briefing:\n\n${documentText}` },
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
      return new Response(JSON.stringify({ error: "Erro ao processar documento" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON from response (may be wrapped in markdown code block)
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
    console.error("parse-briefing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
