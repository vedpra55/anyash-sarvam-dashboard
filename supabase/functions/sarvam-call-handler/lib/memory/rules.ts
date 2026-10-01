/**
 * Phase 3 memory rules, as pure functions. The models propose; these decide
 * what is written. Nothing here does I/O.
 */
import type { TranscriptTurn } from "../call.ts";
import { PROFILE_BLOCKS } from "../../prompts/profile_updater.ts";

export type EventCategory = "health" | "life" | "mood" | "routine";
export type Block = (typeof PROFILE_BLOCKS)[number];

export interface MemoryEvent {
  id: string;
  parent_id: string;
  call_record_id: string | null;
  call_number: number;
  call_date: string;
  category: EventCategory;
  parent_words: string;
  summary: string;
  importance: number;
}

export interface ProfileFact {
  id: string;
  parent_id: string;
  block: Block;
  key: string;
  value: string;
  source: "child" | "parent";
  confirmed: boolean;
  valid_from: string;
  valid_to: string | null;
  last_seen_call_id: string | null;
}

export interface Thread {
  id: string;
  parent_id: string;
  title: string;
  kind: "health" | "life";
  status: "open" | "closed";
  opened_on: string;
  last_update: string;
  next_ask_on: string | null;
  next_ask_call: number | null;
  last_mentioned_call: number;
  importance: number;
  closed_reason: string | null;
  /** The parent's words from the event that last mentioned it. */
  last_words: string | null;
  last_event_id: string | null;
}

/* ------------------------------------------------------------------ */
/* Quotes                                                              */
/* ------------------------------------------------------------------ */

export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Whether `quote` is really something the parent said in `turn`: a substring,
 * or at least 70% of its words appear in the turn (either language).
 */
export function quoteMatches(quote: string, turn: Pick<TranscriptTurn, "text" | "original">): boolean {
  const q = normalizeWords(quote);
  if (q.length === 0) return false;
  for (const said of [turn.text, turn.original]) {
    if (!said) continue;
    const words = normalizeWords(said);
    if (` ${words.join(" ")} `.includes(` ${q.join(" ")} `)) return true;
    const bag = new Set(words);
    const hits = q.filter((w) => bag.has(w)).length;
    if (hits / q.length >= 0.7) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* a. Extractor output                                                 */
/* ------------------------------------------------------------------ */

export interface ProposedEvent {
  turn?: number;
  category?: string;
  parent_words?: string;
  summary?: string;
  importance?: number;
  thread_id?: string | null;
  resolves_thread?: boolean;
  new_thread_title?: string | null;
}

export interface CheckedEvent {
  category: EventCategory;
  parent_words: string;
  summary: string;
  importance: number;
  thread_id: string | null;
  resolves_thread: boolean;
  new_thread_title: string | null;
}

const CATEGORIES: EventCategory[] = ["health", "life", "mood", "routine"];

/**
 * Keeps only events whose quote is something the parent (a "user" turn)
 * actually said. Returns the kept events and why others were dropped.
 */
export function checkEvents(
  proposed: ProposedEvent[] | null | undefined,
  transcript: TranscriptTurn[],
  openThreadIds: Set<string>,
): { events: CheckedEvent[]; dropped: string[] } {
  const events: CheckedEvent[] = [];
  const dropped: string[] = [];
  const parentTurns = transcript.map((t, i) => ({ t, i })).filter(({ t }) => t.role === "user");

  for (const p of proposed || []) {
    const words = String(p?.parent_words || "").trim();
    const summary = String(p?.summary || "").trim();
    const category = CATEGORIES.includes(p?.category as EventCategory) ? (p!.category as EventCategory) : null;
    if (!words || !summary || !category) {
      dropped.push(`incomplete: ${JSON.stringify(p)}`);
      continue;
    }
    const cited = typeof p.turn === "number" ? transcript[p.turn] : undefined;
    const matched =
      (cited?.role === "user" && quoteMatches(words, cited)) || parentTurns.some(({ t }) => quoteMatches(words, t));
    if (!matched) {
      dropped.push(`quote not said by the parent: "${words}"`);
      continue;
    }
    const importance = Math.min(5, Math.max(1, Math.round(Number(p.importance) || 1)));
    const threadId = p.thread_id && openThreadIds.has(p.thread_id) ? p.thread_id : null;
    events.push({
      category,
      parent_words: words,
      summary,
      importance,
      thread_id: threadId,
      resolves_thread: Boolean(threadId && p.resolves_thread),
      new_thread_title: String(p.new_thread_title || "").trim() || null,
    });
  }
  return { events, dropped };
}

/* ------------------------------------------------------------------ */
/* b. Profile updater output                                           */
/* ------------------------------------------------------------------ */

export interface ProposedAction {
  action?: string;
  fact_id?: string;
  block?: string;
  key?: string;
  value?: string;
  event_ids?: string[];
}

export type FactChange =
  | { kind: "add"; block: Block; key: string; value: string; eventIds: string[] }
  | { kind: "confirm"; fact: ProfileFact; eventIds: string[] }
  | { kind: "update"; fact: ProfileFact; value: string; eventIds: string[] };

/** Keys that never go into the living profile. */
const FORBIDDEN_KEYS = new Set(["child_worry"]);

const normValue = (v: string) => normalizeWords(v).join(" ");

/**
 * Numbers in `value` that none of the evidence texts contain. The pieces of a
 * number are compared one by one ("10:30" is 10 and 30), and a 12-hour clock
 * hour may be written as 24-hour (10 -> 22). Totals the model worked out
 * ("~7.5 hrs") are therefore caught.
 */
export function unsupportedNumbers(value: string, evidence: string[]): string[] {
  const parts = (text: string) =>
    (text.match(/\d+(?:[.:]\d+)*/g) || []).flatMap((n) => n.split(/[.:]/)).filter((x) => /[1-9]/.test(x)).map((x) => String(Number(x)));
  const allowed = new Set(evidence.flatMap(parts));
  for (const n of Array.from(allowed)) if (Number(n) <= 12) allowed.add(String(Number(n) + 12));
  return (value.match(/\d+(?:[.:]\d+)*/g) || []).filter((tok) => parts(tok).some((x) => !allowed.has(x)));
}

/**
 * Turns proposed actions into safe changes: every change cites an event from
 * this call, targets a current fact that exists, and nothing is deleted.
 * An ADD for a key that already has a current fact becomes a CONFIRM (same
 * value) or an UPDATE (new value).
 */
export function planFactChanges(
  proposed: ProposedAction[] | null | undefined,
  facts: ProfileFact[],
  callEventIds: Set<string>,
  /** event id -> what the parent said (summary and quote); enables the numbers check. */
  eventTexts?: Map<string, string>,
): { changes: FactChange[]; rejected: string[] } {
  const changes: FactChange[] = [];
  const rejected: string[] = [];
  const current = facts.filter((f) => f.valid_to === null);
  const byId = new Map(current.map((f) => [f.id, f]));
  const byKey = new Map(current.map((f) => [`${f.block}/${f.key}`, f]));
  const touched = new Set<string>();

  for (const a of proposed || []) {
    const eventIds = (a?.event_ids || []).filter((id) => callEventIds.has(id));
    const action = String(a?.action || "").toUpperCase();
    if (action === "NOTHING" || !action) continue;
    if (eventIds.length === 0) {
      rejected.push(`${action} without evidence from this call: ${JSON.stringify(a)}`);
      continue;
    }

    let target: ProfileFact | undefined = a.fact_id ? byId.get(a.fact_id) : undefined;
    const block = PROFILE_BLOCKS.includes(a.block as Block) ? (a.block as Block) : target?.block;
    const key = String(a.key || target?.key || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    const value = String(a.value || "").trim();
    if (FORBIDDEN_KEYS.has(key)) {
      rejected.push(`forbidden key ${key}`);
      continue;
    }
    if (!target && action === "ADD" && block && key) target = byKey.get(`${block}/${key}`);
    if (target && touched.has(target.id)) {
      rejected.push(`second change to fact ${target.id} in one call`);
      continue;
    }

    const invented = value && eventTexts ? unsupportedNumbers(value, [target?.value || "", ...eventIds.map((id) => eventTexts.get(id) || "")]) : [];
    if (invented.length) {
      rejected.push(`value has numbers the parent did not say (${invented.join(", ")}): ${JSON.stringify(a)}`);
      continue;
    }

    if (action === "ADD" && !target) {
      if (!block || !key || !value) {
        rejected.push(`ADD missing block/key/value: ${JSON.stringify(a)}`);
        continue;
      }
      changes.push({ kind: "add", block, key, value, eventIds });
      byKey.set(`${block}/${key}`, { id: `new:${block}/${key}` } as ProfileFact);
      continue;
    }
    if (!target) {
      rejected.push(`${action} names no current fact: ${JSON.stringify(a)}`);
      continue;
    }
    touched.add(target.id);
    const sameValue = !value || normValue(value) === normValue(target.value);
    if (action === "CONFIRM" || (action === "ADD" && sameValue) || (action === "UPDATE" && sameValue)) {
      if (target.confirmed && target.source === "parent") continue; // already the parent's word
      changes.push({ kind: "confirm", fact: target, eventIds });
    } else if (action === "UPDATE" || action === "ADD") {
      changes.push({ kind: "update", fact: target, value, eventIds });
    } else {
      rejected.push(`unknown action ${action}`);
    }
  }
  return { changes, rejected };
}

/* ------------------------------------------------------------------ */
/* c. Threads                                                          */
/* ------------------------------------------------------------------ */

/** A thread not mentioned in this many real calls is closed as faded. */
export const FADE_AFTER_CALLS = 5;

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Importance 4-5: ask on the next call. Importance 3: within 2 calls. */
export function nextAsk(importance: number, callNumber: number, callDate: string) {
  const calls = importance >= 4 ? 1 : 2;
  return { next_ask_call: callNumber + calls, next_ask_on: addDays(callDate, calls) };
}

interface Words {
  last_words: string;
  last_event_id: string | null;
}

export interface ThreadPlan {
  open: ({ title: string; kind: "health" | "life"; importance: number; next_ask_call: number; next_ask_on: string } & Words)[];
  update: ({ id: string; importance: number; next_ask_call: number; next_ask_on: string } & Words)[];
  close: ({ id: string; reason: "resolved" | "faded" } & Partial<Words>)[];
}

const kindOf = (category: EventCategory): "health" | "life" => (category === "health" ? "health" : "life");

export function planThreads(
  events: (CheckedEvent & { id?: string })[],
  openThreads: Thread[],
  callNumber: number,
  callDate: string,
): ThreadPlan {
  const plan: ThreadPlan = { open: [], update: [], close: [] };
  const mentioned = new Map<string, { importance: number; resolved: boolean } & Words>();

  for (const e of events) {
    if (!e.thread_id) continue;
    const m = mentioned.get(e.thread_id) || { importance: 0, resolved: false, last_words: "", last_event_id: null };
    if (e.importance >= m.importance) {
      m.last_words = e.parent_words;
      m.last_event_id = e.id || null;
    }
    m.importance = Math.max(m.importance, e.importance);
    m.resolved = m.resolved || e.resolves_thread;
    mentioned.set(e.thread_id, m);
  }

  for (const t of openThreads) {
    const m = mentioned.get(t.id);
    if (m?.resolved) plan.close.push({ id: t.id, reason: "resolved", last_words: m.last_words, last_event_id: m.last_event_id });
    else if (m) {
      // Still open and talked about: ask again within 2 calls, or next call if it got serious.
      // A casual "theek hai" never lowers a serious thread: keep the highest importance it has had.
      const importance = Math.max(t.importance || 0, m.importance);
      plan.update.push({
        id: t.id,
        importance,
        last_words: m.last_words,
        last_event_id: m.last_event_id,
        ...nextAsk(Math.max(importance, 3), callNumber, callDate),
      });
    } else if (callNumber - t.last_mentioned_call >= FADE_AFTER_CALLS) {
      plan.close.push({ id: t.id, reason: "faded" });
    }
  }

  const titles = new Set(openThreads.map((t) => normValue(t.title)));
  for (const e of events) {
    if (e.thread_id || e.importance < 3) continue;
    const title = (e.new_thread_title || e.summary).slice(0, 120);
    const key = normValue(title);
    if (titles.has(key)) continue;
    titles.add(key);
    plan.open.push({
      title,
      kind: kindOf(e.category),
      importance: e.importance,
      last_words: e.parent_words,
      last_event_id: e.id || null,
      ...nextAsk(e.importance, callNumber, callDate),
    });
  }
  return plan;
}

/**
 * Which open threads the next brief must mention: those whose ask-by call has
 * come, and every life thread raised or talked about on the last real call.
 */
export function splitThreadsForBrief(openThreads: Thread[], upcomingCall: number, lastRealCall: number | null) {
  const required: Thread[] = [];
  const other: Thread[] = [];
  for (const t of openThreads) {
    const due = t.next_ask_call !== null && t.next_ask_call <= upcomingCall;
    const lifeFromLastCall = t.kind === "life" && lastRealCall !== null && t.last_mentioned_call === lastRealCall;
    (due || lifeFromLastCall ? required : other).push(t);
  }
  const byWeight = (a: Thread, b: Thread) => b.importance - a.importance || b.last_mentioned_call - a.last_mentioned_call;
  return { required: required.sort(byWeight), other: other.sort(byWeight) };
}

/* ------------------------------------------------------------------ */
/* d. Reflection                                                       */
/* ------------------------------------------------------------------ */

export const REFLECT_EVERY_CALLS = 5;

export function checkPatterns(
  proposed: { pattern?: string; event_ids?: string[] }[] | null | undefined,
  eventIds: Set<string>,
): { pattern: string; event_ids: string[] }[] {
  return (proposed || [])
    .map((p) => ({
      pattern: String(p?.pattern || "").trim(),
      event_ids: Array.from(new Set((p?.event_ids || []).filter((id) => eventIds.has(id)))),
    }))
    .filter((p) => p.pattern && p.event_ids.length > 0)
    .slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* Pre-call brief                                                      */
/* ------------------------------------------------------------------ */

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const STOP = new Set(["the", "and", "with", "about", "from", "that", "this", "her", "his", "their", "was", "has", "for", "day", "days"]);

/** The words of a thread title that the brief should contain at least one of. */
export function keyWords(title: string): string[] {
  return normalizeWords(title).filter((w) => w.length >= 4 && !STOP.has(w));
}

/** Required threads the brief does not mention. */
export function missingThreads(brief: string, required: { title: string; last_words?: string }[]): { title: string; last_words?: string }[] {
  const words = new Set(normalizeWords(brief));
  return required.filter((t) => {
    const keys = keyWords(t.title);
    const quoteHit = t.last_words ? quoteMatches(t.last_words, { text: brief }) : false;
    return !quoteHit && !(keys.length > 0 && keys.some((k) => words.has(k)));
  });
}
