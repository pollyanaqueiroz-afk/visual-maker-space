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
    const platformUrl = (formData.get("platform_url") as string) || null;

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

    // Parse entry point from manifest
    let entryPoint = "index.html";
    const resourceMatch = manifestContent.match(/<resource[^>]*href="([^"]+)"/i);
    if (resourceMatch) {
      entryPoint = resourceMatch[1];
    } else {
      const fileMatch = manifestContent.match(/<file[^>]*href="([^"]*\.html?)"/i);
      if (fileMatch) {
        entryPoint = fileMatch[1];
      }
    }

    // Generate package ID
    const packageId = crypto.randomUUID();
    const storagePath = packageId;

    // Build the public base URL for the package directory
    const publicBaseUrl = `${supabaseUrl}/storage/v1/object/public/scorm-packages/${storagePath}/`;

    let fileCount = 0;
    let totalSize = 0;

    // Content type map
    const contentTypeMap: Record<string, string> = {
      html: "text/html; charset=utf-8",
      htm: "text/html; charset=utf-8",
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

    // Upload all files to storage
    const entries = Object.entries(zip.files);
    for (const [path, zipEntry] of entries) {
      if ((zipEntry as any).dir) continue;

      // Remove manifest prefix to flatten structure
      let relativePath = path;
      if (manifestPrefix && path.startsWith(manifestPrefix)) {
        relativePath = path.slice(manifestPrefix.length);
      }

      const storageFilePath = `${storagePath}/${relativePath}`;
      const ext = relativePath.split(".").pop()?.toLowerCase() || "";
      const contentType = contentTypeMap[ext] || "application/octet-stream";

      // Check if this file is the entry point
      const isEntryPoint = relativePath === entryPoint;

      let uploadBlob: Blob;

      if (isEntryPoint) {
        // Read as string, inject <base> tag
        let htmlText = await (zipEntry as any).async("string");

        // Determine the base href — if entry point is in a subfolder, base should point to package root
        const baseHref = publicBaseUrl;
        const baseTag = `<base href="${baseHref}">`;

        if (/<head[^>]*>/i.test(htmlText)) {
          // Inject <base> right after <head>
          htmlText = htmlText.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
        } else if (/<html[^>]*>/i.test(htmlText)) {
          // No <head>, create one after <html>
          htmlText = htmlText.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
        } else {
          // No <html> either, prepend
          htmlText = `<head>${baseTag}</head>${htmlText}`;
        }

        const encoded = new TextEncoder().encode(htmlText);
        uploadBlob = new Blob([encoded], { type: contentType });
        totalSize += encoded.length;
      } else {
        const content = await (zipEntry as any).async("uint8array");
        uploadBlob = new Blob([content], { type: contentType });
        totalSize += content.length;
      }

      const { error: uploadError } = await supabase.storage
        .from("scorm-packages")
        .upload(storageFilePath, uploadBlob, {
          contentType,
          upsert: true,
          cacheControl: "public, max-age=31536000",
        });

      if (uploadError) {
        console.error(`Error uploading ${storageFilePath}:`, uploadError);
        continue;
      }

      fileCount++;
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
        platform_url: platformUrl,
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
