import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: call function via fetch to get raw response with status codes
async function callFunction(body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-briefing-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

Deno.test("send-briefing-email - returns 400 when image_id is missing", async () => {
  const { status, data } = await callFunction({ assigned_email: "test@example.com" });
  assertEquals(status, 400);
  assertEquals(data.error, "image_id and assigned_email are required");
});

Deno.test("send-briefing-email - returns 400 when assigned_email is missing", async () => {
  const { status, data } = await callFunction({ image_id: "00000000-0000-0000-0000-000000000000" });
  assertEquals(status, 400);
  assertEquals(data.error, "image_id and assigned_email are required");
});

Deno.test("send-briefing-email - returns 404 for non-existent image", async () => {
  const { status, data } = await callFunction({
    image_id: "00000000-0000-0000-0000-000000000000",
    assigned_email: "designer@example.com",
    deadline: new Date().toISOString(),
    app_url: "https://example.com",
  });
  assertEquals(status, 404);
  assertEquals(data.error, "Image not found");
});

Deno.test("send-briefing-email - processes valid image and updates DB", async () => {
  // Create a briefing request
  const { data: request, error: reqErr } = await supabase
    .from("briefing_requests")
    .insert({
      requester_name: "Teste Automatizado",
      requester_email: "teste@curseduca.com",
      platform_url: "https://teste-auto.curseduca.com",
    })
    .select("id")
    .single();

  assertExists(request, `Failed to create request: ${reqErr?.message}`);

  // Create a briefing image
  const { data: image, error: imgErr } = await supabase
    .from("briefing_images")
    .insert({
      request_id: request.id,
      image_type: "banner_vitrine",
      sort_order: 0,
    })
    .select("id")
    .single();

  assertExists(image, `Failed to create image: ${imgErr?.message}`);

  // Call the function
  const { status, data } = await callFunction({
    image_id: image.id,
    assigned_email: "designer-test@example.com",
    deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
    app_url: "https://example.com",
  });

  // Resend free tier only sends to verified emails, so may return 500
  // But the DB should still have been updated before the email send
  if (status === 200) {
    assertEquals(data.success, true);
    assertExists(data.email_id);
  } else {
    console.log(`Email send returned ${status} (expected on free Resend tier):`, data);
  }

  // Verify the image was updated with assigned_email and delivery_token
  const { data: updated } = await supabase
    .from("briefing_images")
    .select("assigned_email, delivery_token")
    .eq("id", image.id)
    .single();

  assertEquals(updated?.assigned_email, "designer-test@example.com");
  assertExists(updated?.delivery_token, "delivery_token should be set");
});
