/**
 * The Phase 3 pipeline end to end against an in-memory database, with the
 * model replaced by scripted answers.
 */
import { assert, assertEquals } from "jsr:@std/assert@1";
import { fakeDb, stubModel } from "./fake_db.ts";
import { runMemoryPipeline } from "../lib/memory/pipeline.ts";
import { buildBrief, gatherBriefInputs } from "../lib/memory/brief.ts";
import { EXTRACTOR_PROMPT } from "../prompts/extractor.ts";
import { PROFILE_UPDATER_PROMPT } from "../prompts/profile_updater.ts";
import { REFLECTION_PROMPT } from "../prompts/reflection.ts";
import { BRIEF_PROMPT } from "../prompts/brief.ts";
import type { TranscriptTurn } from "../lib/call.ts";

const P = "parent-1";

const transcript: TranscriptTurn[] = [
  { role: "agent", text: "How is the knee now?" },
  { role: "user", text: "Yes, there is relief.", original: "हाँ आराम है।" },
  { role: "agent", text: "How was your day?" },
  { role: "user", text: "Today was great, and some work is going on at home.", original: "आज का दिन बढ़िया रहा और घर में भी काम चल रहा है" },
  { role: "agent", text: "When did you wake up?" },
  { role: "user", text: "At four-thirty.", original: "साढ़े चार बजे" },
];

function world() {
  return fakeDb({
    call_records: [{ id: "call-4", parent_id: P, conversation_signal: "answered_with_prompts", memory_processed_at: null }],
    profile_facts: [
      { id: "f-wake", parent_id: P, block: "routine", key: "wake_time", value: "05:00", source: "child", confirmed: false, valid_from: "2026-09-25", valid_to: null },
      { id: "f-avoid", parent_id: P, block: "sensitivities", key: "avoid_topics", value: "Papa's passing", source: "child", confirmed: false, valid_from: "2026-09-25", valid_to: null },
    ],
    threads: [
      {
        id: "t-knee", parent_id: P, title: "Right knee pain", kind: "health", status: "open", importance: 4,
        opened_on: "2026-09-27", last_update: "2026-09-29", last_mentioned_call: 3, next_ask_call: 4,
        next_ask_on: "2026-09-30", last_words: "ghutne mein dard", last_event_id: null, closed_reason: null,
      },
    ],
    memory_events: [],
    reflections: [],
    call_briefs: [],
  });
}

function model(extra: { reflection?: any; brief?: (u: any, n: number) => string } = {}) {
  let briefCalls = 0;
  return stubModel((system, user) => {
    if (system === EXTRACTOR_PROMPT) {
      return {
        events: [
          { turn: 1, category: "health", parent_words: "हाँ आराम है", summary: "Said the knee has relief", importance: 2, thread_id: "t-knee" },
          { turn: 3, category: "life", parent_words: "घर में भी काम चल रहा है", summary: "Work is going on at home", importance: 3, new_thread_title: "Work going on at home" },
          { turn: 5, category: "routine", parent_words: "साढ़े चार बजे", summary: "Woke at 4:30", importance: 2 },
          { turn: 1, category: "health", parent_words: "the knee is completely healed", summary: "Invented", importance: 2 },
        ],
      };
    }
    if (system === PROFILE_UPDATER_PROMPT) {
      const wake = user.events.find((e: any) => e.summary === "Woke at 4:30");
      return {
        actions: [
          { action: "UPDATE", fact_id: "f-wake", value: "04:30", event_ids: [wake.id] },
          { action: "ADD", block: "health", key: "knee", value: "knee better", event_ids: [] },
        ],
      };
    }
    if (system === REFLECTION_PROMPT) return extra.reflection ?? { patterns: [] };
    if (system === BRIEF_PROMPT) return { brief: extra.brief ? extra.brief(user, ++briefCalls) : "" };
    throw new Error("unexpected prompt");
  });
}

const input = { parentId: P, callRecordId: "call-4", callNumber: 4, callDate: "2026-09-30", transcript, extracted: {} };

Deno.test("pipeline: events, facts and threads for one real call", async () => {
  const w = world();
  const m = model();
  try {
    const r = await runMemoryPipeline(w.client, "key", input);
    assertEquals(r.events, 3);
    assertEquals(r.dropped.length, 1); // the invented quote
    assertEquals(r.rejected.length, 1); // the ADD without evidence
    assertEquals(r.factChanges, 1);
    assertEquals(r.threads, { opened: 1, updated: 1, closed: 0 });

    // Events carry the parent's own words.
    assertEquals(w.tables.memory_events.map((e) => e.parent_words), ["हाँ आराम है", "घर में भी काम चल रहा है", "साढ़े चार बजे"]);

    // Wake time: old child fact closed on the call date, new parent fact current.
    const wake = w.tables.profile_facts.filter((f) => f.key === "wake_time");
    assertEquals(wake.map((f) => [f.value, f.source, f.confirmed, f.valid_to]), [
      ["05:00", "child", false, "2026-09-30"],
      ["04:30", "parent", true, null],
    ]);
    // Nothing deleted.
    assertEquals(w.tables.profile_facts.length, 3);

    // Knee thread followed within 2 calls with the latest words; a new life thread opened.
    const knee = w.tables.threads.find((t) => t.id === "t-knee")!;
    assertEquals([knee.last_mentioned_call, knee.next_ask_call, knee.last_words], [4, 6, "हाँ आराम है"]);
    const work = w.tables.threads.find((t) => t.title === "Work going on at home")!;
    assertEquals([work.kind, work.status, work.next_ask_call, work.last_words], ["life", "open", 6, "घर में भी काम चल रहा है"]);

    assert(w.tables.call_records[0].memory_processed_at);
    assertEquals(w.tables.call_records[0].call_number, 4);
  } finally {
    m.restore();
  }
});

Deno.test("pipeline: a second run for the same call adds nothing", async () => {
  const w = world();
  const m = model();
  try {
    await runMemoryPipeline(w.client, "key", input);
    const again = await runMemoryPipeline(w.client, "key", input);
    assertEquals(again.skipped, "already processed");
    assertEquals(w.tables.memory_events.length, 3);
  } finally {
    m.restore();
  }
});

Deno.test("pipeline: reflection after the 5th processed call, citing real events only", async () => {
  const w = world();
  for (let i = 1; i <= 4; i++) {
    w.tables.call_records.push({ id: `old-${i}`, parent_id: P, call_number: i - 1, memory_processed_at: `2026-09-2${i}T10:00:00Z` });
    w.tables.memory_events.push({ id: `ev-${i}`, parent_id: P, call_record_id: `old-${i}`, call_number: i - 1, call_date: `2026-09-2${i}`, category: "life", parent_words: "garmi bahut hai", summary: "Said it is very hot", importance: 3 });
  }
  const m = model({
    reflection: {
      patterns: [
        { pattern: "Talks about the heat most days", event_ids: ["ev-1", "ev-2", "ev-3"] },
        { pattern: "Made-up pattern", event_ids: ["does-not-exist"] },
      ],
    },
  });
  try {
    const r = await runMemoryPipeline(w.client, "key", input);
    assertEquals(r.reflection, true);
    assertEquals(w.tables.reflections.length, 1);
    assertEquals(w.tables.reflections[0].patterns, [{ pattern: "Talks about the heat most days", event_ids: ["ev-1", "ev-2", "ev-3"] }]);
    assertEquals(w.tables.reflections[0].calls_covered, [0, 1, 2, 3, 4]);
  } finally {
    m.restore();
  }
});

Deno.test("pipeline: no parent turns, nothing recorded", async () => {
  const w = world();
  const m = model();
  try {
    const r = await runMemoryPipeline(w.client, "key", { ...input, transcript: [{ role: "agent", text: "Hello?" }] });
    assertEquals(r.skipped, "no parent turns in transcript");
    assertEquals(w.tables.memory_events.length, 0);
  } finally {
    m.restore();
  }
});

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

Deno.test("brief: inputs never include child_worry; life thread from the last call is required", async () => {
  const w = world();
  const m = model();
  try {
    await runMemoryPipeline(w.client, "key", input);
    w.tables.profile_facts.push({ id: "f-worry", parent_id: P, block: "person", key: "child_worry", value: "SECRET WORRY", source: "child", confirmed: false, valid_to: null });
    const inputs = await gatherBriefInputs(w.client, P, 5, "2026-10-01");
    assert(!JSON.stringify(inputs).includes("SECRET WORRY"));
    assertEquals(inputs.threads_required.map((t) => t.title), ["Work going on at home"]);
    assertEquals(inputs.threads_other.map((t) => t.title), ["Right knee pain"]);
  } finally {
    m.restore();
  }
});

Deno.test("brief: retried when it leaves out a required thread, then saved", async () => {
  const w = world();
  const m = model({
    brief: (_u, n) =>
      n === 1 ? `Sunita lives alone. ${words(125)}` : `Sunita lives alone. Ask about the work going on at home ("घर में भी काम चल रहा है"). ${words(118)}`,
  });
  try {
    await runMemoryPipeline(w.client, "key", input);
    const r = await buildBrief(w.client, "key", { parentId: P, callNumber: 5, mode: "shadow" });
    assertEquals(r.checks.attempts, 2);
    assertEquals(r.checks.missing_threads, []);
    assertEquals(r.checks.appended, false);
    assertEquals(w.tables.call_briefs.length, 1);
    assertEquals(w.tables.call_briefs[0].mode, "shadow");
    assertEquals(w.tables.call_briefs[0].call_number, 5);
  } finally {
    m.restore();
  }
});

Deno.test("brief: a thread the model keeps leaving out is appended, never lost", async () => {
  const w = world();
  const m = model({ brief: () => `Sunita lives alone. ${words(125)}` });
  try {
    await runMemoryPipeline(w.client, "key", input);
    const r = await buildBrief(w.client, "key", { parentId: P, callNumber: 5, mode: "shadow" });
    assertEquals(r.checks.appended, true);
    assert(r.brief!.includes('Also follow up: Work going on at home ("घर में भी काम चल रहा है")'));
  } finally {
    m.restore();
  }
});
