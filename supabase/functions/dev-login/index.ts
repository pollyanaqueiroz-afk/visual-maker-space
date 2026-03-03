import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEV_EMAIL = "dev@curseduca.com";
const DEV_PASSWORD = "dev-access-2026!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Try to sign in first
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey);

    let signInResult = await anonClient.auth.signInWithPassword({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    });

    // If user doesn't exist, create it
    if (signInResult.error) {
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: "Dev Admin" },
      });

      if (createErr) {
        // If already exists but wrong password, update password
        if (createErr.message?.includes("already")) {
          const { data: users } = await admin.auth.admin.listUsers();
          const existingUser = users?.users?.find((u) => u.email === DEV_EMAIL);
          if (existingUser) {
            await admin.auth.admin.updateUserById(existingUser.id, {
              password: DEV_PASSWORD,
            });
          }
        } else {
          throw createErr;
        }
      }

      // Assign admin role
      const userId = newUser?.user?.id;
      if (userId) {
        await admin
          .from("user_roles")
          .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

        // Create profile
        await admin
          .from("profiles")
          .upsert(
            { user_id: userId, email: DEV_EMAIL, display_name: "Dev Admin" },
            { onConflict: "user_id" }
          );
      }

      // Sign in again
      signInResult = await anonClient.auth.signInWithPassword({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
      });
    }

    if (signInResult.error) {
      throw signInResult.error;
    }

    // Ensure admin role exists for this user
    const userId = signInResult.data.user!.id;
    await admin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    return new Response(
      JSON.stringify({
        access_token: signInResult.data.session!.access_token,
        refresh_token: signInResult.data.session!.refresh_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Dev login error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
