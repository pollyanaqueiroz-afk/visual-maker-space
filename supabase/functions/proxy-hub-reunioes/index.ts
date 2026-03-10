const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_URL = "https://us-central1-curseduca-inc-ia.cloudfunctions.net/hub-reunioes";

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
    const incomingUrl = new URL(req.url);
    const action = incomingUrl.searchParams.get("action");

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = new URL(API_URL);
    // Forward all query params
    incomingUrl.searchParams.forEach((value, key) => {
      apiUrl.searchParams.set(key, value);
    });

    const fetchOpts: RequestInit = {
      method: req.method === "POST" ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
    };

    if (req.method === "POST") {
      const body = await req.text();
      if (body) {
        fetchOpts.body = body;
      }
    }

    const apiRes = await fetch(apiUrl.toString(), fetchOpts);
    const responseBody = await apiRes.text();

    return new Response(responseBody, {
      status: apiRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[proxy-hub-reunioes] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
