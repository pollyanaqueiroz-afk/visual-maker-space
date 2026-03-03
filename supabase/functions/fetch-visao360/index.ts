const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_URL = "https://us-central1-curseduca-inc-ia.cloudfunctions.net/hub-clientes";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiUser = Deno.env.get("VISAO360_API_USER");
    const apiPass = Deno.env.get("VISAO360_API_PASSWORD");
    if (!apiUser || !apiPass) {
      throw new Error("Credenciais da API Visão 360 não configuradas");
    }

    const url = new URL(req.url);
    const idCurseduca = url.searchParams.get("id_curseduca");
    const page = url.searchParams.get("page") || "1";
    const perPage = url.searchParams.get("per_page") || "10";
    const search = url.searchParams.get("search") || "";
    const view = url.searchParams.get("view") || "";

    const basicAuth = btoa(`${apiUser}:${apiPass}`);

    let apiUrl: string;
    if (idCurseduca) {
      apiUrl = `${API_URL}?id_curseduca=${encodeURIComponent(idCurseduca)}`;
    } else {
      const params = new URLSearchParams({ page, per_page: perPage });
      if (view) params.set("view", view);
      if (search) params.set("search", search);
      apiUrl = `${API_URL}?${params.toString()}`;
    }

    const apiRes = await fetch(apiUrl, {
      headers: { Authorization: `Basic ${basicAuth}` },
    });

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
  } catch (error: any) {
    console.error("Fetch error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
