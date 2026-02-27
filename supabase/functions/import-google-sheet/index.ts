const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function extractSheetId(url: string): string | null {
  // Matches Google Sheets URLs like:
  // https://docs.google.com/spreadsheets/d/SHEET_ID/...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function extractGid(url: string): string {
  const match = url.match(/[#&]gid=(\d+)/);
  return match ? match[1] : '0';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'URL é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sheetId = extractSheetId(url);
    if (!sheetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL inválida. Use um link do Google Sheets (ex: https://docs.google.com/spreadsheets/d/...)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gid = extractGid(url);
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    console.log('Fetching Google Sheet:', exportUrl);

    const response = await fetch(exportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: 'Planilha não encontrada. Verifique o link.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (status === 403 || status === 401) {
        return new Response(
          JSON.stringify({ success: false, error: 'Sem permissão. Compartilhe a planilha com "Qualquer pessoa com o link pode ver".' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao acessar planilha (HTTP ${status})` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const csvText = await response.text();

    // Check if we got HTML instead of CSV (redirect to login page)
    if (csvText.trim().startsWith('<!') || csvText.trim().startsWith('<html')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão. Compartilhe a planilha com "Qualquer pessoa com o link pode ver".' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`CSV fetched: ${csvText.length} bytes`);

    return new Response(
      JSON.stringify({ success: true, csv: csvText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
