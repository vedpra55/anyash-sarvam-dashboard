/**
 * sarvam-call-handler: Sarvam's tools for the Anyash Health agent.
 *
 * - In call: `query_parent_history` answers from daily_health_logs.
 * - After the call: the on_end tool `record_call_assessment` records the call,
 *   and for a real conversation consolidates memory (see lib/postcall.ts).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { answerHistoryQuery, isHistoryQuery } from "./lib/history.ts";
import { recordCallAssessment } from "./lib/postcall.ts";
import { runMemoryPipeline } from "./lib/memory/pipeline.ts";
import { backfillParent } from "./lib/memory/backfill.ts";
import { isInternalCall } from "./lib/memory/secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const openAiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_KEY") || "";
/** MEMORY_V1=off stops the old current_user_context rewrite (Phase 3 briefs replace it). */
const memoryV1 = (Deno.env.get("MEMORY_V1") ?? "on").toLowerCase() !== "off";

/** Work that continues after the response is sent. */
function inBackground(label: string, work: Promise<unknown>) {
  const guarded = work.catch((err) => console.error(`${label} failed:`, err));
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(guarded);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return json({
      message: "Anyash memory and assessment service is online.",
      supported_actions: ["query_parent_history", "record_call_assessment (post-call)"],
      openai_configured: Boolean(openAiKey),
      memory_v1: memoryV1,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase environment configuration missing" }, 500);
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch (err) {
    return json({ error: "Invalid JSON body", details: String(err) }, 400);
  }

  const { interaction_transcript, transcript, messages, ...loggable } = body;
  const transcriptPresent = Boolean(interaction_transcript || transcript || messages);
  console.log("Received action payload:", JSON.stringify({ ...loggable, transcript_present: transcriptPresent }));

  try {
    if (isHistoryQuery(body)) return json(await answerHistoryQuery(supabase, body));

    if (body.action === "memory_backfill") {
      if (!(await isInternalCall(supabase, req))) return json({ error: "Not allowed" }, 403);
      if (!body.parent_id) return json({ error: "parent_id is required" }, 400);
      inBackground(`[backfill ${body.parent_id}]`, backfillParent(supabase, openAiKey, body.parent_id, Number(body.max_calls) || 2));
      return json({ success: true, action: "memory_backfill", started: body.parent_id });
    }

    const { memory, ...result } = await recordCallAssessment(supabase, body, openAiKey, { memoryV1 });
    if (memory) inBackground(`[memory ${memory.callRecordId}]`, runMemoryPipeline(supabase, openAiKey, memory));
    return json(result);
  } catch (err: any) {
    console.error("sarvam-call-handler error:", err);
    return json({ error: err?.message || "Internal server error" }, 500);
  }
});
