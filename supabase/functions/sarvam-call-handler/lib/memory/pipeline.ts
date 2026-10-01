/**
 * Phase 3 post-call memory pipeline, run for real calls only:
 *   a. extract events -> b. update profile facts -> c. update threads -> d. reflect every 5 calls.
 * The models propose; lib/memory/rules.ts decides what is written.
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { TranscriptTurn } from "../call.ts";
import { chatJson } from "../llm.ts";
import { EXTRACTOR_PROMPT } from "../../prompts/extractor.ts";
import { PROFILE_UPDATER_PROMPT } from "../../prompts/profile_updater.ts";
import { REFLECTION_PROMPT } from "../../prompts/reflection.ts";
import {
  checkEvents,
  checkPatterns,
  planFactChanges,
  planThreads,
  REFLECT_EVERY_CALLS,
  type MemoryEvent,
  type ProfileFact,
  type Thread,
} from "./rules.ts";

export interface PipelineInput {
  parentId: string;
  callRecordId: string;
  callNumber: number;
  /** India date of the call, "YYYY-MM-DD". */
  callDate: string;
  transcript: TranscriptTurn[];
  extracted: Record<string, unknown>;
}

export interface PipelineResult {
  skipped?: string;
  events: number;
  dropped: string[];
  factChanges: number;
  rejected: string[];
  threads: { opened: number; updated: number; closed: number };
  reflection: boolean;
}

function fail(step: string, error: unknown): never {
  throw new Error(`${step}: ${(error as any)?.message || error}`);
}

export async function runMemoryPipeline(
  supabase: SupabaseClient,
  openAiKey: string,
  input: PipelineInput,
): Promise<PipelineResult> {
  const { parentId, callRecordId, callNumber, callDate, transcript } = input;
  const tag = `[memory ${callRecordId}]`;
  const result: PipelineResult = {
    events: 0,
    dropped: [],
    factChanges: 0,
    rejected: [],
    threads: { opened: 0, updated: 0, closed: 0 },
    reflection: false,
  };

  // Runs once per call: a retry or a backfill never adds events twice.
  const { data: record } = await supabase
    .from("call_records")
    .select("id, memory_processed_at")
    .eq("id", callRecordId)
    .maybeSingle();
  if (record?.memory_processed_at) return { ...result, skipped: "already processed" };
  const { data: earlier } = await supabase.from("memory_events").select("id").eq("call_record_id", callRecordId).limit(1);
  if (earlier?.length) {
    // An earlier run stopped part-way; events are insert-only, so never extract twice.
    await supabase.from("call_records").update({ memory_processed_at: new Date().toISOString(), call_number: callNumber }).eq("id", callRecordId);
    return { ...result, skipped: "events already recorded by an earlier run" };
  }
  if (!transcript.some((t) => t.role === "user")) return { ...result, skipped: "no parent turns in transcript" };

  // a. Extractor
  const { data: openRows, error: threadErr } = await supabase
    .from("threads")
    .select("*")
    .eq("parent_id", parentId)
    .eq("status", "open");
  if (threadErr) fail("load threads", threadErr);
  const openThreads = (openRows || []) as Thread[];

  const { result: extraction } = await chatJson<{ events: any[] }>(
    openAiKey,
    EXTRACTOR_PROMPT,
    JSON.stringify({
      call_date: callDate,
      call_number: callNumber,
      transcript: transcript.map((t, index) => ({ index, role: t.role, text: t.text, original: t.original })),
      extracted_variables: input.extracted,
      open_threads: openThreads.map((t) => ({ id: t.id, title: t.title, kind: t.kind })),
    }),
    { label: `${tag} extractor` },
  );
  if (!extraction) return { ...result, skipped: "extractor returned nothing" };

  const checked = checkEvents(extraction.events, transcript, new Set(openThreads.map((t) => t.id)));
  result.dropped = checked.dropped;
  if (checked.dropped.length) console.warn(`${tag} dropped ${checked.dropped.length} events:`, checked.dropped);

  let events: (MemoryEvent & (typeof checked.events)[number])[] = [];
  if (checked.events.length) {
    const { data, error } = await supabase
      .from("memory_events")
      .insert(
        checked.events.map((e) => ({
          parent_id: parentId,
          call_record_id: callRecordId,
          call_number: callNumber,
          call_date: callDate,
          category: e.category,
          parent_words: e.parent_words,
          summary: e.summary,
          importance: e.importance,
        })),
      )
      .select("*");
    if (error) fail("insert events", error);
    // Insert keeps order, so each row lines up with its checked event.
    events = (data || []).map((row: any, i: number) => ({ ...checked.events[i], ...row }));
  }
  result.events = events.length;

  // b. Profile updater
  if (events.length) {
    const { data: factRows, error: factErr } = await supabase
      .from("profile_facts")
      .select("*")
      .eq("parent_id", parentId)
      .is("valid_to", null);
    if (factErr) fail("load facts", factErr);
    const facts = (factRows || []) as ProfileFact[];

    const { result: proposal } = await chatJson<{ actions: any[] }>(
      openAiKey,
      PROFILE_UPDATER_PROMPT,
      JSON.stringify({
        call_date: callDate,
        events: events.map((e) => ({ id: e.id, category: e.category, parent_words: e.parent_words, summary: e.summary })),
        facts: facts.map((f) => ({ id: f.id, block: f.block, key: f.key, value: f.value, source: f.source, confirmed: f.confirmed })),
      }),
      { label: `${tag} profile` },
    );
    const plan = planFactChanges(
      proposal?.actions,
      facts,
      new Set(events.map((e) => e.id)),
      new Map(events.map((e) => [e.id, `${e.summary} ${e.parent_words}`])),
    );
    result.rejected = plan.rejected;
    if (plan.rejected.length) console.warn(`${tag} rejected fact actions:`, plan.rejected);

    for (const change of plan.changes) {
      if (change.kind === "add") {
        const { error } = await supabase.from("profile_facts").insert({
          parent_id: parentId,
          block: change.block,
          key: change.key,
          value: change.value,
          source: "parent",
          confirmed: true,
          valid_from: callDate,
          last_seen_call_id: callRecordId,
        });
        if (error) fail("add fact", error);
      } else if (change.kind === "confirm") {
        const { error } = await supabase
          .from("profile_facts")
          .update({ confirmed: true, source: "parent", last_seen_call_id: callRecordId })
          .eq("id", change.fact.id);
        if (error) fail("confirm fact", error);
      } else {
        const { error: closeErr } = await supabase
          .from("profile_facts")
          .update({ valid_to: callDate })
          .eq("id", change.fact.id)
          .is("valid_to", null);
        if (closeErr) fail("close fact", closeErr);
        const { error } = await supabase.from("profile_facts").insert({
          parent_id: parentId,
          block: change.fact.block,
          key: change.fact.key,
          value: change.value,
          source: "parent",
          confirmed: true,
          valid_from: callDate,
          last_seen_call_id: callRecordId,
        });
        if (error) fail("update fact", error);
      }
      result.factChanges++;
    }
  }

  // c. Threads
  const threadPlan = planThreads(events, openThreads, callNumber, callDate);
  for (const t of threadPlan.open) {
    const { error } = await supabase.from("threads").insert({
      parent_id: parentId,
      title: t.title,
      kind: t.kind,
      status: "open",
      importance: t.importance,
      last_words: t.last_words,
      last_event_id: t.last_event_id,
      opened_on: callDate,
      last_update: callDate,
      last_mentioned_call: callNumber,
      next_ask_on: t.next_ask_on,
      next_ask_call: t.next_ask_call,
    });
    if (error) fail("open thread", error);
  }
  for (const t of threadPlan.update) {
    const { error } = await supabase
      .from("threads")
      .update({
        importance: t.importance,
        last_words: t.last_words,
        last_event_id: t.last_event_id,
        last_update: callDate,
        last_mentioned_call: callNumber,
        next_ask_on: t.next_ask_on,
        next_ask_call: t.next_ask_call,
      })
      .eq("id", t.id);
    if (error) fail("update thread", error);
  }
  for (const t of threadPlan.close) {
    const { error } = await supabase
      .from("threads")
      .update({
        status: "closed",
        closed_reason: t.reason,
        next_ask_on: null,
        next_ask_call: null,
        // A resolved thread records the parent's closing words; a faded one keeps its last ones.
        ...(t.reason === "resolved" ? { last_update: callDate, last_mentioned_call: callNumber, last_words: t.last_words, last_event_id: t.last_event_id } : {}),
      })
      .eq("id", t.id);
    if (error) fail("close thread", error);
  }
  result.threads = { opened: threadPlan.open.length, updated: threadPlan.update.length, closed: threadPlan.close.length };

  // Mark the call processed, then reflect on every 5th processed call.
  const { error: markErr } = await supabase
    .from("call_records")
    .update({ memory_processed_at: new Date().toISOString(), call_number: callNumber })
    .eq("id", callRecordId);
  if (markErr) fail("mark call", markErr);

  result.reflection = await maybeReflect(supabase, openAiKey, parentId, tag);
  console.log(`${tag} done:`, JSON.stringify(result));
  return result;
}

/** d. After every 5th processed real call, write 2-3 patterns from those calls. */
async function maybeReflect(supabase: SupabaseClient, openAiKey: string, parentId: string, tag: string): Promise<boolean> {
  const { data: calls, error } = await supabase
    .from("call_records")
    .select("id, call_number, conversation_signal, memory_processed_at")
    .eq("parent_id", parentId)
    .not("memory_processed_at", "is", null)
    .order("memory_processed_at", { ascending: true });
  if (error) fail("count calls", error);
  const processed = calls || [];
  if (processed.length === 0 || processed.length % REFLECT_EVERY_CALLS !== 0) return false;

  const window = processed.slice(-REFLECT_EVERY_CALLS);
  const { data: rows, error: evErr } = await supabase
    .from("memory_events")
    .select("id, call_record_id, call_number, call_date, category, parent_words, summary, importance")
    .in("call_record_id", window.map((c: any) => c.id));
  if (evErr) fail("load reflection events", evErr);
  const events = rows || [];
  if (events.length < 2) return false;

  const { result } = await chatJson<{ patterns: any[] }>(
    openAiKey,
    REFLECTION_PROMPT,
    JSON.stringify({
      calls: window.map((c: any) => ({
        call_number: c.call_number,
        call_date: events.find((e: any) => e.call_record_id === c.id)?.call_date,
        conversation_signal: c.conversation_signal,
        events: events
          .filter((e: any) => e.call_record_id === c.id)
          .map((e: any) => ({ id: e.id, category: e.category, parent_words: e.parent_words, summary: e.summary, importance: e.importance })),
      })),
    }),
    { label: `${tag} reflection` },
  );
  const patterns = checkPatterns(result?.patterns, new Set(events.map((e: any) => e.id)));
  if (patterns.length === 0) return false;

  const { error: insErr } = await supabase.from("reflections").insert({
    parent_id: parentId,
    calls_covered: window.map((c: any) => c.call_number).filter((n: any) => Number.isFinite(n)),
    patterns,
  });
  if (insErr) fail("insert reflection", insErr);
  return true;
}
