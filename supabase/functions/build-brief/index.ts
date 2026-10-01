/**
 * build-brief: writes the pre-call brief for a parent's next call and saves it
 * to call_briefs. Called by the dashboard's outbound route just before each call.
 *
 * POST { parent_id, call_number?, mode?: "shadow" | "live" | "example" }
 * Header x-memory-secret: public.internal_config memory_secret.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildBrief } from "../sarvam-call-handler/lib/memory/brief.ts";
import { isInternalCall } from "../sarvam-call-handler/lib/memory/secret.ts";

const openAiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ message: "build-brief is online", openai_configured: Boolean(openAiKey) });

  const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", {
    auth: { persistSession: false },
  });
  if (!(await isInternalCall(supabase, req))) return json({ error: "Not allowed" }, 403);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.parent_id) return json({ error: "parent_id is required" }, 400);
  const mode = ["shadow", "live", "example"].includes(body.mode) ? body.mode : "shadow";

  try {
    const result = await buildBrief(supabase, openAiKey, {
      parentId: body.parent_id,
      callNumber: Number(body.call_number) || undefined,
      mode,
    });
    return json(result, result.brief ? 200 : 502);
  } catch (err: any) {
    console.error("build-brief failed:", err);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});
