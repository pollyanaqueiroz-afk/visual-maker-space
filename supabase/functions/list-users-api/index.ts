import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_TOKEN = "WxYVWSfUJ3kslYCkqlyo5DMdsQHzBA1guEvgAlF86T4CiMqPmPbrVEemby5udFaq";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Basic Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return new Response(JSON.stringify({ error: "Missing Basic auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Basic ", "").trim();
  if (token !== VALID_TOKEN) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all auth users
    const { data: authData, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) throw authErr;

    // Fetch roles
    const { data: roles } = await admin.from("user_roles").select("*");

    const users = authData.users.map((u) => ({
      id: u.id,
      email: u.email,
      display_name: u.user_metadata?.display_name || u.user_metadata?.full_name || u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      roles: (roles || []).filter((r) => r.user_id === u.id).map((r) => r.role),
    }));

    return new Response(JSON.stringify({ total: users.length, users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
