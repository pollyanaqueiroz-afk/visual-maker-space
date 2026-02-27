import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    if (action === "list") {
      const { data, error } = await supabase.rpc("get_client_columns");
      if (error) throw error;
      return new Response(JSON.stringify({ columns: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { columns } = body;
      if (!Array.isArray(columns) || columns.length === 0) {
        return new Response(JSON.stringify({ error: "No columns provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const validName = /^[a-z][a-z0-9_]{0,62}$/;
      const reservedColumns = ["id", "client_url", "client_name", "loyalty_index", "cs_user_id", "created_at", "updated_at"];

      const results = [];
      for (const col of columns) {
        const colName = col.name;
        if (!validName.test(colName)) {
          results.push({ name: col.name, db_name: colName, success: false, error: "Invalid column name" });
          continue;
        }
        if (reservedColumns.includes(colName)) {
          results.push({ name: col.name, db_name: colName, success: false, error: "Reserved column name" });
          continue;
        }

        const { error } = await supabase.rpc("add_client_column", {
          col_name: colName,
          col_type: col.type || "text",
        });

        if (error) {
          if (error.message?.includes("already exists")) {
            results.push({ name: col.name, db_name: colName, success: true, already_existed: true });
          } else {
            results.push({ name: col.name, db_name: colName, success: false, error: error.message });
          }
        } else {
          results.push({ name: col.name, db_name: colName, success: true });
        }
      }

      return new Response(JSON.stringify({ results }), {
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
