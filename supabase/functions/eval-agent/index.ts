/**
 * eval-agent: our own Sarvam-style evals.
 *
 * POST (header x-memory-secret) with { action, ... }:
 *   reply  { prompt_text, opening_line?, vars, turns }   one agent turn, for manual testing
 *   step   { result_id }                                 advance a scenario in a run a few exchanges
 *   grade  { turns, ended?, scenario?, checks?, criteria? }  grade any conversation
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isInternalCall } from "../sarvam-call-handler/lib/memory/secret.ts";
import { agentSystem, agentTurn } from "./lib/agent.ts";
import { DEFAULT_OPENING, gradeCall, stepResult, varsFor } from "./lib/runner.ts";
import { estimateSeconds, renderTemplate, talkStats, type Turn } from "./lib/transcript.ts";

const apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENAI_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ message: "eval-agent is online", openai_configured: Boolean(apiKey) });

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

  try {
    if (body.action === "step") {
      if (!body.result_id) return json({ error: "result_id is required" }, 400);
      const out = await stepResult(supabase, apiKey, String(body.result_id));
      return json({ ...out, result: undefined, status: out.done ? "done" : "running", passed: out.done ? (out as any).result?.passed : null });
    }

    if (body.action === "reply") {
      const text = String(body.prompt_text || "");
      if (!text) return json({ error: "prompt_text is required" }, 400);
      const vars = varsFor({
        parent_name: body.vars?.parent_name,
        child_name: body.vars?.child_name,
        honorific: body.vars?.honorific,
        call_number: Number(body.vars?.call_number) || 1,
        user_context: body.vars?.user_context,
      });
      const turns: Turn[] = Array.isArray(body.turns) ? body.turns : [];
      if (turns.length === 0) {
        return json({ text: renderTemplate(String(body.opening_line || DEFAULT_OPENING), vars), ends: false, est_seconds: 0 });
      }
      const a = await agentTurn(apiKey, agentSystem(text, vars), turns);
      return json({ text: a.text, ends: a.ends, est_seconds: estimateSeconds([...turns, { role: "agent", text: a.text }]) });
    }

    if (body.action === "grade") {
      const turns: Turn[] = Array.isArray(body.turns) ? body.turns : [];
      if (turns.length < 2) return json({ error: "Nothing to grade yet" }, 400);
      const g = await gradeCall(
        apiKey,
        turns,
        body.ended || "limit",
        { name: body.scenario?.name || "Manual conversation", persona: body.scenario?.persona, notes: body.scenario?.notes },
        body.checks || null,
        body.criteria || null,
      );
      return json({ ...g, stats: talkStats(turns) });
    }

    return json({ error: `Unknown action ${body.action}` }, 400);
  } catch (err: any) {
    console.error("eval-agent failed:", err);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});
