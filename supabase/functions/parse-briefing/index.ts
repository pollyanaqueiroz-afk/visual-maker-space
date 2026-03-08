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

    if (documentText.length > 100000) {
      return new Response(JSON.stringify({ error: "Documento muito grande. Máximo: 100.000 caracteres." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Pré-processar o texto para melhorar a extração
    let processedText = documentText
      .replace(/\t+/g, ' | ')
      .replace(/ {3,}/g, ' | ')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');

    if (processedText.length > 80000) {
      processedText = processedText.slice(0, 80000) + '\n\n[... texto truncado por exceder limite ...]';
    }

    const systemPrompt = `Você é um extrator especializado de dados de documentos de briefing de design da plataforma Curseduca.

CONTEXTO:
Os documentos são formulários preenchidos por clientes da Curseduca solicitando artes para suas plataformas de educação. Os documentos podem vir em diferentes formatos:
- Tabelas com colunas "Campo" e "Valor"
- Campos em negrito seguidos de texto (ex: "Nome da plataforma: MeuSite")
- Formulários Google convertidos para PDF/Word
- Textos livres com informações misturadas
- Planilhas convertidas para documento

CAMPOS COMUNS NOS DOCUMENTOS (podem aparecer com nomes diferentes):
- URL/link/endereço da plataforma → platform_url
- Link do Drive/Google Drive/identidade visual/manual de marca → brand_drive_link
- Trilha/trilhas/tem trilha → has_trail
- Desafio/desafios/tem desafio → has_challenge
- Comunidade/tem comunidade → has_community

CAMPOS POR ARTE (podem aparecer como colunas de tabela ou seções):
- Tipo da arte/tipo de imagem → image_type
- Nome do produto/módulo/curso → product_name
- Texto da imagem/texto do banner/copy/título → image_text
- Fonte/tipografia/font → font_suggestion
- Elemento/imagem sugerida/referência visual → element_suggestion
- Foto do profissional/foto/imagem profissional/URL foto → professional_photo_url
- Orientação/formato → orientation (horizontal ou vertical)
- Observações/notas/comentários → observations
- Informações adicionais/extras → extra_info

MAPEAMENTO DE TIPOS DE ARTE:
- "Área de login", "login", "tela de login", "imagem de login" → "login"
- "Banner", "vitrine", "banner principal", "banner rotativo", "banner home" → "banner_vitrine"
- "Capa", "capa de produto", "capa de curso", "thumbnail", "cover" → "product_cover"
- "Trilha", "banner de trilha", "imagem da trilha" → "trail_banner"
- "Desafio", "banner de desafio", "imagem do desafio" → "challenge_banner"
- "Comunidade", "banner de comunidade", "imagem da comunidade" → "community_banner"
- "Mockup", "app", "aplicativo" → "app_mockup"

INSTRUÇÕES:
1. Analise o texto completo do documento e identifique TODOS os dados presentes
2. Se o documento tem uma tabela com múltiplos produtos/módulos, crie uma entrada image separada para CADA produto
3. Se um campo aparece com nome diferente do esperado, mapeie para o campo correto
4. Se o texto contém "BANNER 1", "BANNER 2", etc., crie entradas separadas para cada banner
5. Se informações aparecem em formato "label: valor" ou em tabela, extraia corretamente
6. URLs de fotos profissionais podem estar em formato de link do Google Drive, Dropbox, etc. — inclua tal como está
7. Texto com "horizontal" ou "vertical" em contexto de orientação → mapear para orientation
8. Se houver menção a cores, estilo visual, público-alvo, tom de comunicação → colocar em extra_info
9. NÃO deixe campos vazios se a informação existe no documento — procure com atenção
10. Se a URL da plataforma não estiver explícita, procure por qualquer menção a ".curseduca.pro", ".curseduca.com" ou domínio similar

Retorne EXATAMENTE no formato JSON abaixo. Use string vazia "" para campos não encontrados.

{
  "platform_url": "URL da plataforma",
  "brand_drive_link": "link do Google Drive",
  "has_trail": false,
  "has_challenge": false,
  "has_community": false,
  "images": [
    {
      "image_type": "login",
      "product_name": "",
      "image_text": "texto da imagem",
      "font_suggestion": "fonte sugerida",
      "element_suggestion": "elemento sugerido",
      "professional_photo_url": "link da foto",
      "orientation": "horizontal ou vertical",
      "observations": "observações",
      "extra_info": "informações extras úteis para o designer"
    }
  ]
}

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional, sem markdown, sem explicações.`;

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
          {
            role: "user",
            content: `Extraia os dados deste briefing de design da Curseduca. O documento pode conter tabelas, listas, campos em negrito ou texto livre. Identifique TODOS os campos e artes mencionados:\n\n${processedText}`,
          },
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

    // Validar e normalizar
    if (!parsed.platform_url) parsed.platform_url = '';
    if (!parsed.brand_drive_link) parsed.brand_drive_link = '';
    if (typeof parsed.has_trail !== 'boolean') parsed.has_trail = false;
    if (typeof parsed.has_challenge !== 'boolean') parsed.has_challenge = false;
    if (typeof parsed.has_community !== 'boolean') parsed.has_community = false;
    if (!Array.isArray(parsed.images)) parsed.images = [];

    // Normalizar cada imagem
    parsed.images = parsed.images.map((img: any) => ({
      image_type: img.image_type || 'banner_vitrine',
      product_name: img.product_name || '',
      image_text: img.image_text || '',
      font_suggestion: img.font_suggestion || '',
      element_suggestion: img.element_suggestion || '',
      professional_photo_url: img.professional_photo_url || '',
      orientation: ['horizontal', 'vertical'].includes(img.orientation?.toLowerCase?.()) ? img.orientation.toLowerCase() : '',
      observations: img.observations || '',
      extra_info: img.extra_info || '',
    }));

    // Remover imagens completamente vazias
    parsed.images = parsed.images.filter((img: any) =>
      img.image_text || img.product_name || img.element_suggestion || img.observations || img.professional_photo_url
    );

    // Se a IA não encontrou nenhuma imagem mas o texto é longo, criar entrada genérica para revisão manual
    if (parsed.images.length === 0 && processedText.length > 200) {
      parsed.images.push({
        image_type: 'banner_vitrine',
        product_name: '',
        image_text: '',
        font_suggestion: '',
        element_suggestion: '',
        professional_photo_url: '',
        orientation: '',
        observations: 'ATENÇÃO: A IA não conseguiu extrair artes estruturadas deste documento. Revise o texto original e preencha manualmente.',
        extra_info: processedText.slice(0, 2000),
      });
    }

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
