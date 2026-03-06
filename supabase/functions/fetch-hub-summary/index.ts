const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_URL = "https://us-central1-curseduca-inc-ia.cloudfunctions.net/hub-summary";

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429 && attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      console.log(`Rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    return res;
  }
  throw new Error("Max retries exceeded");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiUser = Deno.env.get("VISAO360_API_USER");
    const apiPass = Deno.env.get("VISAO360_API_PASSWORD");
    if (!apiUser || !apiPass) {
      throw new Error("Credenciais da API não configuradas");
    }

    const basicAuth = btoa(`${apiUser}:${apiPass}`);
    const fetchOpts = { headers: { Authorization: `Basic ${basicAuth}` } };

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");

    if (endpoint === "clientes") {
      const idCurseduca = url.searchParams.get("id_curseduca");
      const page = url.searchParams.get("page") || "1";
      const perPage = url.searchParams.get("per_page") || "10";
      const search = url.searchParams.get("search") || "";
      const view = url.searchParams.get("view") || "";
      const csEmail = url.searchParams.get("cs_email_atual") || "";

      let apiUrl: string;
      if (idCurseduca) {
        apiUrl = `https://us-central1-curseduca-inc-ia.cloudfunctions.net/hub-clientes?id_curseduca=${encodeURIComponent(idCurseduca)}`;
      } else {
        const params = new URLSearchParams({ page, per_page: perPage });
        if (view) params.set("view", view);
        if (search) params.set("search", search);
        if (csEmail) params.set("cs_email_atual", csEmail);
        apiUrl = `https://us-central1-curseduca-inc-ia.cloudfunctions.net/hub-clientes?${params.toString()}`;
      }

      const apiRes = await fetchWithRetry(apiUrl, fetchOpts);

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        throw new Error(`API retornou ${apiRes.status}: ${errText}`);
      }

      const apiData = await apiRes.json();

      return new Response(
        JSON.stringify({
          data: apiData.data || [],
          total: apiData.total || 0,
          page: apiData.page || 1,
          per_page: apiData.per_page || 10,
          total_pages: apiData.total_pages || 1,
          view: apiData.view || null,
          available_views: apiData.available_views || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: summary endpoint
    const csEmailSummary = url.searchParams.get("cs_email_atual") || "";
    let summaryUrl = API_URL;
    if (csEmailSummary) {
      summaryUrl += `?cs_email_atual=${encodeURIComponent(csEmailSummary)}`;
    }
    const apiRes = await fetchWithRetry(summaryUrl, fetchOpts);

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      throw new Error(`API retornou ${apiRes.status}: ${errText}`);
    }

    const apiData = await apiRes.json();

    return new Response(JSON.stringify(apiData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Fetch hub error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});