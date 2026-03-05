import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = (formData.get("title") as string) || "Pacote SCORM";
    const description = (formData.get("description") as string) || "";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Find imsmanifest.xml
    let manifestContent: string | null = null;
    let manifestPrefix = "";

    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (path.toLowerCase().endsWith("imsmanifest.xml") && !(zipEntry as any).dir) {
        manifestContent = await (zipEntry as any).async("string");
        // Determine prefix (e.g. if manifest is inside a subfolder)
        const parts = path.split("/");
        if (parts.length > 1) {
          manifestPrefix = parts.slice(0, -1).join("/") + "/";
        }
        break;
      }
    }

    if (!manifestContent) {
      return new Response(
        JSON.stringify({ error: "imsmanifest.xml not found in ZIP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse entry point from manifest - look for first resource href
    let entryPoint = "index.html";
    // Simple regex to find the first resource with an href
    const resourceMatch = manifestContent.match(/<resource[^>]*href="([^"]+)"/i);
    if (resourceMatch) {
      entryPoint = resourceMatch[1];
    } else {
      // Try to find first file element inside a resource
      const fileMatch = manifestContent.match(/<file[^>]*href="([^"]*\.html?)"/i);
      if (fileMatch) {
        entryPoint = fileMatch[1];
      }
    }

    // Generate package ID
    const packageId = crypto.randomUUID();
    const storagePath = packageId;

    let fileCount = 0;
    let totalSize = 0;

    // Upload all files to storage
    const entries = Object.entries(zip.files);
    for (const [path, zipEntry] of entries) {
      if ((zipEntry as any).dir) continue;

      const content = await (zipEntry as any).async("uint8array");
      // Remove manifest prefix to flatten structure
      let relativePath = path;
      if (manifestPrefix && path.startsWith(manifestPrefix)) {
        relativePath = path.slice(manifestPrefix.length);
      }

      const storagFilePath = `${storagePath}/${relativePath}`;

      // Determine content type
      const ext = relativePath.split(".").pop()?.toLowerCase() || "";
      const contentTypeMap: Record<string, string> = {
        html: "text/html",
        htm: "text/html",
        css: "text/css",
        js: "application/javascript",
        json: "application/json",
        xml: "application/xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        mp4: "video/mp4",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        woff: "font/woff",
        woff2: "font/woff2",
        ttf: "font/ttf",
        eot: "application/vnd.ms-fontobject",
        swf: "application/x-shockwave-flash",
        pdf: "application/pdf",
      };
      const contentType = contentTypeMap[ext] || "application/octet-stream";

      const { error: uploadError } = await supabase.storage
        .from("scorm-packages")
        .upload(storagFilePath, content, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error(`Error uploading ${storagFilePath}:`, uploadError);
        continue;
      }

      fileCount++;
      totalSize += content.length;
    }

    // Insert record
    const { data: pkg, error: insertError } = await supabase
      .from("scorm_packages")
      .insert({
        id: packageId,
        title,
        description: description || null,
        entry_point: entryPoint,
        storage_path: storagePath,
        file_count: fileCount,
        file_size_bytes: totalSize,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ package: pkg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-scorm error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
