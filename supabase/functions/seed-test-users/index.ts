import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEST_USERS = [
  { email: "cassio@curseduca.com", password: "123456", display_name: "Cassio", role: "admin" },
  { email: "carlos@curseduca.com", password: "visao360", display_name: "Carlos", role: "cs" },
  { email: "cliente.teste@curseduca.com", password: "cliente123", display_name: "Cliente Teste", role: "cliente" },
  { email: "cassio@stackanalytics.com.br", password: "123456", display_name: "Cassio Stack", role: "admin" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const results: { email: string; status: string }[] = [];

    for (const u of TEST_USERS) {
      // Try to find existing user
      const { data: listData } = await admin.auth.admin.listUsers();
      const existing = listData?.users?.find((x) => x.email === u.email);

      let userId: string;

      if (existing) {
        userId = existing.id;
        // Ensure password is correct
        await admin.auth.admin.updateUserById(userId, { password: u.password });
        results.push({ email: u.email, status: "already_exists_updated" });
      } else {
        const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { display_name: u.display_name },
        });
        if (createErr) throw createErr;
        userId = newUser.user!.id;
        results.push({ email: u.email, status: "created" });
      }

      // Upsert role
      await admin
        .from("user_roles")
        .upsert({ user_id: userId, role: u.role }, { onConflict: "user_id,role" });

      // Upsert profile
      await admin
        .from("profiles")
        .upsert(
          { user_id: userId, email: u.email, display_name: u.display_name },
          { onConflict: "user_id" }
        );
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
