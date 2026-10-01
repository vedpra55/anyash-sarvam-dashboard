/**
 * Replays a parent's past real calls (those with a stored transcript) through
 * the memory pipeline, oldest first, then builds an example brief.
 *
 * At most `maxCalls` calls are replayed per run so one run stays well inside
 * the function's time limit; the brief is built once none are left.
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { classifyCall, countParentTurns, istIsoDate, normalizeTranscript } from "../call.ts";
import { runMemoryPipeline } from "./pipeline.ts";
import { buildBrief } from "./brief.ts";

/** The wanted call number, or the next unused one when it is already taken. */
export function pickCallNumber(wanted: number, used: Set<number>): number {
  let n = wanted > 0 ? wanted : 1;
  while (used.has(n)) n++;
  return n;
}

export async function backfillParent(supabase: SupabaseClient, openAiKey: string, parentId: string, maxCalls = 2) {
  const { data: calls, error } = await supabase
    .from("call_records")
    .select("*")
    .eq("parent_id", parentId)
    .eq("call_status", "connected")
    .is("memory_processed_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  // Call numbers already used by this parent's processed calls; each replayed call gets a unique one.
  const { data: taken } = await supabase
    .from("call_records")
    .select("call_number")
    .eq("parent_id", parentId)
    .not("memory_processed_at", "is", null);
  const used = new Set<number>((taken || []).map((r: any) => Number(r.call_number)).filter(Number.isFinite));

  const results = [];
  let index = 0;
  let replayed = 0;
  let remaining = 0;
  for (const call of calls || []) {
    index++;
    const transcript = normalizeTranscript({ transcript: call.transcript });
    if (!transcript.some((t) => t.role === "user")) {
      results.push({ call: call.id, skipped: "no transcript" });
      continue;
    }
    // Older rows were marked connected before the real-call rule existed.
    const real = classifyCall({
      durationSeconds: Number(call.duration_seconds) || 0,
      parentTurns: countParentTurns(transcript),
      callOutcome: call.call_outcome,
      legacy: false,
    });
    if (!real.isReal) {
      results.push({ call: call.id, skipped: `not a real call: ${real.reasons.join("; ")}` });
      continue;
    }
    if (replayed >= maxCalls) {
      remaining++;
      continue;
    }
    replayed++;
    const callNumber = pickCallNumber(Number(call.call_number ?? call.raw_agent_variables?.number_of_calls) || index, used);
    used.add(callNumber);
    const r = await runMemoryPipeline(supabase, openAiKey, {
      parentId,
      callRecordId: call.id,
      callNumber,
      callDate: istIsoDate(new Date(call.created_at)),
      transcript,
      extracted: {
        call_outcome: call.call_outcome,
        call_summary: call.call_summary,
        health_update: call.health_update,
        personal_context: call.personal_context,
        follow_up_detail: call.follow_up_detail,
        parent_mood: call.parent_mood,
      },
    });
    results.push({ call: call.id, callNumber, ...r });
  }
  const brief = remaining === 0 ? await buildBrief(supabase, openAiKey, { parentId, mode: "example" }) : null;
  console.log(`[backfill ${parentId}]`, JSON.stringify({ results, remaining, brief: brief?.checks ?? null }));
  return { results, remaining, brief };
}
