import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const callerId = claimsData.claims.sub;

  // Check admin role
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });

  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // LIST USERS
    if (req.method === "GET" && action === "list") {
      const { data: authUsers, error: authErr } =
        await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (authErr) throw authErr;

      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("*");

      const users = authUsers.users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name:
          u.user_metadata?.display_name ||
          u.user_metadata?.full_name ||
          u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: (roles || [])
          .filter((r) => r.user_id === u.id)
          .map((r) => r.role),
      }));

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ADD ROLE
    if (req.method === "POST" && action === "add-role") {
      const { user_id, role } = await req.json();
      if (!user_id || !role) throw new Error("user_id and role are required");
      const validRoles = ["admin", "member", "designer", "cs", "implantacao", "gerente_cs", "gerente_implantacao", "cliente"];
      if (!validRoles.includes(role))
        throw new Error("Invalid role");

      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id, role }, { onConflict: "user_id,role" });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REMOVE ROLE
    if (req.method === "POST" && action === "remove-role") {
      const { user_id, role } = await req.json();
      if (!user_id || !role) throw new Error("user_id and role are required");

      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("role", role);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // INVITE USER
    if (req.method === "POST" && action === "invite") {
      const { email } = await req.json();
      if (!email) throw new Error("email is required");

      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
      if (error) {
        // If user already exists, treat as success
        if (error.message?.includes("already been registered")) {
          return new Response(JSON.stringify({ success: true, already_exists: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE USER
    if (req.method === "POST" && action === "delete-user") {
      const { user_id } = await req.json();
      if (!user_id) throw new Error("user_id is required");
      if (user_id === callerId) throw new Error("Cannot delete yourself");

      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
