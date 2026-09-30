import { assertEquals } from "jsr:@std/assert@1";
import {
  checkEvents,
  checkPatterns,
  missingThreads,
  nextAsk,
  planFactChanges,
  planThreads,
  quoteMatches,
  splitThreadsForBrief,
  type ProfileFact,
  type Thread,
} from "../lib/memory/rules.ts";
import type { TranscriptTurn } from "../lib/call.ts";

const transcript: TranscriptTurn[] = [
  { role: "agent", text: "Has the electricity come back?" },
  { role: "user", text: "Yes, the electricity came back at night, around 10 or 11.", original: "हाँ, रात में बिजली आई, 10 बजे 11 बजे के करीब" },
  { role: "agent", text: "How is the knee?" },
  { role: "user", text: "Yes, there is relief.", original: "हाँ आराम है।" },
  { role: "user", text: "Today was great, and there is some work going on at home.", original: "आज का दिन बढ़िया रहा और घर में भी काम चल रहा है" },
];

// ---- quotes ------------------------------------------------------------------

Deno.test("quotes must be the parent's words, in either language", () => {
  assertEquals(quoteMatches("हाँ आराम है", transcript[3]), true);
  assertEquals(quoteMatches("there is relief", transcript[3]), true);
  assertEquals(quoteMatches("घर में भी काम चल रहा है", transcript[4]), true);
  assertEquals(quoteMatches("knee pain has completely gone", transcript[3]), false);
});

Deno.test("events: invented quotes and Anyash's words are dropped", () => {
  const { events, dropped } = checkEvents(
    [
      { turn: 3, category: "health", parent_words: "हाँ आराम है", summary: "Said the knee has relief", importance: 2, thread_id: "t-knee" },
      { turn: 0, category: "life", parent_words: "Has the electricity come back", summary: "Agent asked", importance: 3 },
      { turn: 3, category: "health", parent_words: "knee is fully healed now", summary: "Knee healed", importance: 2 },
      { turn: 4, category: "life", parent_words: "घर में भी काम चल रहा है", summary: "Work going on at home", importance: 3, new_thread_title: "Work at home" },
      { category: "sleep", parent_words: "x", summary: "bad category", importance: 2 },
    ],
    transcript,
    new Set(["t-knee"]),
  );
  assertEquals(events.map((e) => e.summary), ["Said the knee has relief", "Work going on at home"]);
  assertEquals(events[0].thread_id, "t-knee");
  assertEquals(dropped.length, 3);
});

Deno.test("events: unknown thread ids are cleared and importance is clamped", () => {
  const { events } = checkEvents(
    [{ turn: 3, category: "health", parent_words: "there is relief", summary: "s", importance: 9, thread_id: "nope", resolves_thread: true }],
    transcript,
    new Set(),
  );
  assertEquals(events[0].thread_id, null);
  assertEquals(events[0].resolves_thread, false);
  assertEquals(events[0].importance, 5);
});

// ---- facts ---------------------------------------------------------------------

const fact = (over: Partial<ProfileFact>): ProfileFact => ({
  id: "f1",
  parent_id: "p",
  block: "routine",
  key: "wake_time",
  value: "05:00",
  source: "child",
  confirmed: false,
  valid_from: "2026-09-25",
  valid_to: null,
  last_seen_call_id: null,
  ...over,
});

Deno.test("facts: every change needs evidence from this call", () => {
  const { changes, rejected } = planFactChanges(
    [{ action: "ADD", block: "likes", key: "hobby", value: "gardening", event_ids: [] }],
    [],
    new Set(["e1"]),
  );
  assertEquals(changes, []);
  assertEquals(rejected.length, 1);
});

Deno.test("facts: CONFIRM, UPDATE and ADD", () => {
  const facts = [fact({}), fact({ id: "f2", block: "household", key: "cooks", value: "she cooks" })];
  const { changes } = planFactChanges(
    [
      { action: "CONFIRM", fact_id: "f2", event_ids: ["e1"] },
      { action: "UPDATE", fact_id: "f1", value: "06:00", event_ids: ["e2"] },
      { action: "ADD", block: "likes", key: "grandson name", value: "Aarav", event_ids: ["e3"] },
    ],
    facts,
    new Set(["e1", "e2", "e3"]),
  );
  assertEquals(changes.map((c) => c.kind), ["confirm", "update", "add"]);
  assertEquals((changes[2] as any).key, "grandson_name");
});

Deno.test("facts: an ADD for an existing key becomes CONFIRM or UPDATE; child_worry is refused", () => {
  const facts = [fact({})];
  const same = planFactChanges([{ action: "ADD", block: "routine", key: "wake_time", value: "05:00", event_ids: ["e1"] }], facts, new Set(["e1"]));
  assertEquals(same.changes[0].kind, "confirm");
  const diff = planFactChanges([{ action: "ADD", block: "routine", key: "wake_time", value: "06:30", event_ids: ["e1"] }], facts, new Set(["e1"]));
  assertEquals(diff.changes[0].kind, "update");
  const worry = planFactChanges([{ action: "ADD", block: "person", key: "child_worry", value: "x", event_ids: ["e1"] }], [], new Set(["e1"]));
  assertEquals(worry.changes, []);
});

Deno.test("facts: closed facts can't be targeted; one change per fact per call", () => {
  const facts = [fact({ valid_to: "2026-09-28" }), fact({ id: "f3", key: "sleep_time", value: "22:30" })];
  const { changes, rejected } = planFactChanges(
    [
      { action: "UPDATE", fact_id: "f1", value: "07:00", event_ids: ["e1"] },
      { action: "UPDATE", fact_id: "f3", value: "23:00", event_ids: ["e1"] },
      { action: "CONFIRM", fact_id: "f3", event_ids: ["e1"] },
    ],
    facts,
    new Set(["e1"]),
  );
  assertEquals(changes.length, 1);
  assertEquals(rejected.length, 2);
});

Deno.test("facts: a fact already confirmed by the parent is not re-confirmed", () => {
  const { changes } = planFactChanges(
    [{ action: "CONFIRM", fact_id: "f1", event_ids: ["e1"] }],
    [fact({ source: "parent", confirmed: true })],
    new Set(["e1"]),
  );
  assertEquals(changes, []);
});

// ---- threads -------------------------------------------------------------------

const thread = (over: Partial<Thread>): Thread => ({
  id: "t1",
  parent_id: "p",
  title: "Knee pain",
  kind: "health",
  status: "open",
  opened_on: "2026-09-25",
  last_update: "2026-09-25",
  next_ask_on: "2026-09-26",
  next_ask_call: 4,
  last_mentioned_call: 3,
  importance: 4,
  closed_reason: null,
  last_words: "ghutne mein dard",
  last_event_id: null,
  ...over,
});

const ev = (over: any) => ({
  category: "life",
  parent_words: "w",
  summary: "s",
  importance: 2,
  thread_id: null,
  resolves_thread: false,
  new_thread_title: null,
  ...over,
});

Deno.test("threads: next ask is the next call for 4-5, within 2 calls for 3", () => {
  assertEquals(nextAsk(5, 4, "2026-09-30"), { next_ask_call: 5, next_ask_on: "2026-10-01" });
  assertEquals(nextAsk(3, 4, "2026-09-30"), { next_ask_call: 6, next_ask_on: "2026-10-02" });
});

Deno.test("threads: open for importance 3+, not for routine details, no duplicates", () => {
  const plan = planThreads(
    [
      ev({ id: "e1", summary: "Power cut and heat", importance: 3, new_thread_title: "Power cut and heat" }),
      ev({ id: "e2", summary: "Power cut and heat", importance: 3, new_thread_title: "Power cut and heat" }),
      ev({ id: "e3", summary: "Had dal chawal", importance: 2 }),
      ev({ id: "e4", category: "health", summary: "New back pain", importance: 4, parent_words: "kamar mein dard" }),
    ],
    [],
    4,
    "2026-09-30",
  );
  assertEquals(plan.open.map((o) => [o.title, o.kind, o.next_ask_call]), [
    ["Power cut and heat", "life", 6],
    ["New back pain", "health", 5],
  ]);
  assertEquals(plan.open[1].last_words, "kamar mein dard");
});

Deno.test("threads: talked about -> updated; resolved -> closed; silent 5 calls -> faded", () => {
  const plan = planThreads(
    [
      ev({ id: "e1", category: "health", thread_id: "t1", importance: 2, parent_words: "haan aaram hai" }),
      ev({ id: "e2", thread_id: "t2", resolves_thread: true, parent_words: "bijli aa gayi" }),
    ],
    [
      thread({}),
      thread({ id: "t2", title: "Power cut", kind: "life" }),
      thread({ id: "t3", title: "Grandson exams", kind: "life", last_mentioned_call: 1 }),
      thread({ id: "t4", title: "Cooking help", kind: "life", last_mentioned_call: 2 }),
    ],
    6,
    "2026-09-30",
  );
  assertEquals(plan.update.map((u) => [u.id, u.next_ask_call, u.last_words]), [["t1", 8, "haan aaram hai"]]);
  assertEquals(plan.close, [
    { id: "t2", reason: "resolved", last_words: "bijli aa gayi", last_event_id: "e2" },
    { id: "t3", reason: "faded" },
  ]);
});

Deno.test("brief: required threads are due ones plus life threads from the last call", () => {
  const { required, other } = splitThreadsForBrief(
    [
      thread({ id: "due", next_ask_call: 5 }),
      thread({ id: "life-last", kind: "life", next_ask_call: 7, last_mentioned_call: 4 }),
      thread({ id: "later", kind: "health", next_ask_call: 7, last_mentioned_call: 4 }),
      thread({ id: "old-life", kind: "life", next_ask_call: 9, last_mentioned_call: 2 }),
    ],
    5,
    4,
  );
  assertEquals(required.map((t) => t.id).sort(), ["due", "life-last"]);
  assertEquals(other.map((t) => t.id).sort(), ["later", "old-life"]);
});

Deno.test("brief: missing threads are detected by title words or the parent's quote", () => {
  const brief = 'Ask about the power situation; she said "bijli aa gayi". Check the knee.';
  const missing = missingThreads(brief, [
    { title: "Power cut and heat" },
    { title: "Knee pain", last_words: "ghutne mein dard" },
    { title: "Grandson visiting Sunday", last_words: "pota aa raha hai" },
  ]);
  assertEquals(missing.map((m) => m.title), ["Grandson visiting Sunday"]);
});

// ---- reflection ----------------------------------------------------------------

Deno.test("reflection: patterns must cite known events; at most 3", () => {
  const out = checkPatterns(
    [
      { pattern: "Appetite drops on hot days", event_ids: ["a", "b", "zzz"] },
      { pattern: "No evidence", event_ids: ["zzz"] },
      { pattern: "", event_ids: ["a"] },
      { pattern: "p3", event_ids: ["a"] },
      { pattern: "p4", event_ids: ["b"] },
      { pattern: "p5", event_ids: ["b"] },
    ],
    new Set(["a", "b"]),
  );
  assertEquals(out.map((p) => p.pattern), ["Appetite drops on hot days", "p3", "p4"]);
  assertEquals(out[0].event_ids, ["a", "b"]);
});
