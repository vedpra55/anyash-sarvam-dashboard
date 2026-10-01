/**
 * The pre-call brief: gathers the parent's current facts, due threads, the
 * latest reflection and recent events, asks the model for 120-150 words, and
 * checks the result before saving it to call_briefs.
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { chatJson } from "../llm.ts";
import { istIsoDate } from "../call.ts";
import { BRIEF_MAX_WORDS, BRIEF_MIN_WORDS, BRIEF_PROMPT } from "../../prompts/brief.ts";
import { addDays, countWords, missingThreads, splitThreadsForBrief, type ProfileFact, type Thread } from "./rules.ts";

/** Words outside this range get one retry. */
const SOFT_MIN = BRIEF_MIN_WORDS - 10;
const SOFT_MAX = BRIEF_MAX_WORDS + 15;

export interface BriefResult {
  briefId: string | null;
  brief: string | null;
  callNumber: number;
  checks: { words: number; missing_threads: string[]; attempts: number; appended: boolean };
  error?: string;
}

/** Gathers everything the brief may use. Never reads child_worry. */
export async function gatherBriefInputs(supabase: SupabaseClient, parentId: string, callNumber: number, today: string) {
  const [factsRes, threadsRes, reflectionRes, callsRes] = await Promise.all([
    supabase.from("profile_facts").select("*").eq("parent_id", parentId).is("valid_to", null),
    supabase.from("threads").select("*").eq("parent_id", parentId).eq("status", "open"),
    supabase.from("reflections").select("*").eq("parent_id", parentId).order("created_at", { ascending: false }).limit(1),
    supabase
      .from("call_records")
      .select("id, call_number, conversation_signal, memory_processed_at")
      .eq("parent_id", parentId)
      .not("memory_processed_at", "is", null)
      .order("memory_processed_at", { ascending: false })
      .limit(3),
  ]);
  for (const r of [factsRes, threadsRes, reflectionRes, callsRes]) if (r.error) throw new Error(r.error.message);

  const facts = ((factsRes.data || []) as ProfileFact[]).filter((f) => f.key !== "child_worry");
  const lastCalls = callsRes.data || [];
  const lastRealCall = lastCalls[0]?.call_number ?? null;
  const { required, other } = splitThreadsForBrief((threadsRes.data || []) as Thread[], callNumber, lastRealCall);

  const weekAgo = addDays(today, -7);
  const [recentRes, weekRes] = await Promise.all([
    lastCalls.length
      ? supabase
          .from("memory_events")
          .select("call_number, call_date, category, parent_words, summary, importance")
          .in("call_record_id", lastCalls.map((c: any) => c.id))
          .order("call_number", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("memory_events")
      .select("call_date, summary")
      .eq("parent_id", parentId)
      .eq("category", "health")
      .gte("call_date", weekAgo),
  ]);
  if (recentRes.error) throw new Error(recentRes.error.message);
  if (weekRes.error) throw new Error(weekRes.error.message);

  const threadView = (t: Thread) => ({ title: t.title, kind: t.kind, last_words: t.last_words, since: t.opened_on });
  return {
    call_number: callNumber,
    today,
    facts: facts.map((f) => ({ block: f.block, key: f.key, value: f.value, confirmed: f.confirmed })),
    threads_required: required.map(threadView),
    threads_other: other.slice(0, 3).map(threadView),
    reflection: reflectionRes.data?.[0]?.patterns?.map((p: any) => p.pattern) || [],
    recent_events: recentRes.data || [],
    how_recent_calls_went: lastCalls.map((c: any) => ({ call_number: c.call_number, conversation_signal: c.conversation_signal })),
    health_this_week: (weekRes.data || []).map((e: any) => e.summary),
    health_areas: ["sleep", "food and appetite", "pain and mobility", "medicines", "energy and mood", "BP or sugar readings"],
  };
}

/** Sentences about what is empty rather than what to do; the agent would read them aloud. */
export const META_SENTENCE = /\b(?:there (?:are|is) no|no) (?:required |open |follow-?up )+(?:follow-?up )?threads?[^.]*\.?|\bnone listed\b[^.]*\.?|\bnothing (?:is )?required\b[^.]*\.?/i;

export type BriefInputs = Awaited<ReturnType<typeof gatherBriefInputs>>;

/**
 * Asks for the brief, retries once if it is off-length or leaves out a
 * required thread, then appends any still-missing thread so none is lost.
 */
export async function writeBrief(openAiKey: string, inputs: BriefInputs, label: string) {
  const payload = JSON.stringify(inputs);
  let brief = "";
  let attempts = 0;
  let feedback = "";
  while (attempts < 2) {
    attempts++;
    const { result } = await chatJson<{ brief: string }>(
      openAiKey,
      BRIEF_PROMPT,
      feedback ? `${payload}\n\nYour previous brief had problems: ${feedback}. Write it again.` : payload,
      { effort: "low", label: `${label} brief` },
    );
    brief = String(result?.brief || "").trim();
    if (!brief) continue;
    const words = countWords(brief);
    const missing = missingThreads(brief, inputs.threads_required.map((t) => ({ title: t.title, last_words: t.last_words || undefined })));
    const filler = META_SENTENCE.exec(brief)?.[0];
    const problems = [
      words < SOFT_MIN || words > SOFT_MAX ? `it was ${words} words, it must be ${BRIEF_MIN_WORDS} to ${BRIEF_MAX_WORDS}` : "",
      missing.length ? `it left out these required threads: ${missing.map((m) => m.title).join("; ")}` : "",
      filler ? `it says "${filler}"; write only facts and things to ask, never what is missing` : "",
    ].filter(Boolean);
    if (problems.length === 0) break;
    feedback = problems.join("; ");
  }

  let appended = false;
  const missing = brief
    ? missingThreads(brief, inputs.threads_required.map((t) => ({ title: t.title, last_words: t.last_words || undefined })))
    : [];
  if (brief && missing.length) {
    brief += ` Also follow up: ${missing.map((m) => (m.last_words ? `${m.title} ("${m.last_words}")` : m.title)).join("; ")}.`;
    appended = true;
  }
  return {
    brief: brief || null,
    checks: { words: countWords(brief), missing_threads: missing.map((m) => m.title), attempts, appended },
  };
}

/** Builds, checks and saves the brief for a parent's next call. */
export async function buildBrief(
  supabase: SupabaseClient,
  openAiKey: string,
  { parentId, callNumber, mode }: { parentId: string; callNumber?: number; mode: "shadow" | "live" | "example" },
): Promise<BriefResult> {
  let number = callNumber;
  if (!number) {
    const { data, error } = await supabase.from("parent_profiles").select("number_of_calls").eq("id", parentId).maybeSingle();
    if (error || !data) throw new Error(error?.message || "Parent not found");
    number = Number(data.number_of_calls) || 1;
  }
  const inputs = await gatherBriefInputs(supabase, parentId, number, istIsoDate(new Date()));
  const { brief, checks } = await writeBrief(openAiKey, inputs, `[brief ${parentId}]`);
  if (!brief) {
    return { briefId: null, brief: null, callNumber: number, checks, error: "The model returned no brief." };
  }

  const { data, error } = await supabase
    .from("call_briefs")
    .insert({ parent_id: parentId, call_number: number, brief_text: brief, used_in_call: false, mode, inputs, checks })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { briefId: data.id, brief, callNumber: number, checks };
}
