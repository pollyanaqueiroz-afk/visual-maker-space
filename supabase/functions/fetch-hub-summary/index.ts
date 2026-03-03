const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_URL = "https://us-central1-curseduca-inc-ia.cloudfunctions.net/hub-summary";

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

    const apiRes = await fetch(API_URL, {
      headers: { Authorization: `Basic ${basicAuth}` },
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      throw new Error(`API retornou ${apiRes.status}: ${errText}`);
    }

    const apiData = await apiRes.json();

    return new Response(JSON.stringify(apiData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Fetch hub-summary error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
