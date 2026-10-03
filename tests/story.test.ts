import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, buildStory, isConversation, istDay, period, StoryCall, whenLabel } from "../lib/story";

// 10:00 IST on a day key
const at = (key: string, hh = 19, mm = 10) => new Date(Date.parse(`${key}T00:00:00Z`) + (hh * 60 + mm - 330) * 60000).toISOString();
const call = (key: string, over: Partial<StoryCall> = {}): StoryCall => ({
  attempt_id: `a-${key}-${over.seconds ?? 120}-${over.status ?? "c"}`,
  at: at(key),
  status: "connected",
  seconds: 120,
  outcome: "meaningful_checkin",
  ...over,
});
const NOW = new Date(at("2026-10-03", 21, 0));

test("India days and conversations", () => {
  assert.equal(istDay(Date.parse("2026-10-02T19:00:00Z")), "2026-10-03"); // 00:30 IST next day
  assert.equal(isConversation(call("2026-10-01")), true);
  assert.equal(isConversation(call("2026-10-01", { status: "no_answer", seconds: 0, outcome: undefined })), false);
  assert.equal(isConversation(call("2026-10-01", { outcome: undefined, seconds: 30 })), false);
  assert.equal(isConversation(call("2026-10-01", { outcome: undefined, seconds: 50 })), true);
  assert.equal(isConversation(call("2026-10-01", { outcome: "busy_or_refused", seconds: 90 })), false);
});

test("days, streaks and totals", () => {
  const calls = [
    call("2026-09-28"),
    call("2026-09-29"),
    call("2026-09-30", { status: "no_answer", seconds: 0, outcome: undefined }),
    call("2026-10-01"),
    call("2026-10-02"),
    // today: only a missed call so far
    call("2026-10-03", { status: "no_answer", seconds: 0, outcome: undefined }),
  ];
  const s = buildStory({ joinedAt: at("2026-09-28", 9), calls, logs: [], reviews: [], events: [], threads: [], now: NOW });
  assert.equal(s.start, "2026-09-28");
  assert.equal(s.dayNumber, 6);
  assert.deepEqual(s.days.map((d) => d.state), ["talked", "talked", "missed", "talked", "talked", "missed"]);
  assert.equal(s.daysTalked, 4);
  assert.equal(s.streak, 2); // today isn't over yet, so the run through yesterday counts
  assert.equal(s.bestStreak, 2);
  assert.equal(s.bestStreakStart, "2026-09-28");
  assert.equal(s.minutes, 8);
  // No conversation that day: no marks at all.
  assert.equal(s.days[2].marks.food, "x");
  // Talked but nothing about food: not mentioned.
  assert.equal(s.days[0].marks.food, "n");
});

test("areas come from the health log and Sarvam's mood, never guessed", () => {
  const s = buildStory({
    calls: [call("2026-10-03", { mood: "low_or_flat" })],
    logs: [
      {
        log_date: "2026-10-03",
        appetite: "normal",
        sleep_quality: "poor",
        medication_adherence: { adherence: "taken", refill_warnings: "" },
        mobility_and_pain: { pain_reported: true, nature: "knee" },
      },
    ],
    reviews: [],
    events: [],
    threads: [],
    now: NOW,
  });
  assert.deepEqual(s.days[0].marks, { food: "g", sleep: "w", medicine: "g", body: "w", mood: "w" });
  assert.equal(s.days[0].notes.body, "Knee");
});

test("status follows the latest AI review, else Sarvam's follow-up flag", () => {
  const base = { logs: [], events: [], threads: [], now: NOW };
  const c = call("2026-10-03", { summary: "Talked about the puja. All fine.", followUpNeeded: "no" });
  assert.equal(buildStory({ ...base, calls: [c], reviews: [] }).status.label, "All good");
  const flagged = { ...c, followUpNeeded: "yes", followUpDetail: "Knee pain again." };
  assert.equal(buildStory({ ...base, calls: [flagged], reviews: [] }).status.line, "Knee pain again.");
  const s = buildStory({ ...base, calls: [c], reviews: [{ attempt_id: c.attempt_id, at: c.at, decision: "MONITOR", observation: "Headache from fasting." }] });
  assert.deepEqual([s.status.label, s.status.tone, s.status.line], ["Keep an eye", "watch", "Headache from fasting."]);
});

test("periods carry context", () => {
  const s = buildStory({ joinedAt: at("2026-09-01", 9), calls: [], logs: [], reviews: [], events: [], threads: [], role: "mother", now: NOW });
  assert.deepEqual(period("day", "2026-10-03", s), {
    kind: "day", from: "2026-10-03", to: "2026-10-03", label: "Saturday 3 Oct", context: "Day 33 with Anyash", relative: "Today",
  });
  const w = period("week", "2026-10-03", s);
  assert.equal(w.from, "2026-09-27");
  assert.equal(w.context, "Week 5 since she joined");
  const m = period("month", "2026-10-03", s);
  assert.deepEqual([m.from, m.to, m.context, m.relative], ["2026-10-01", "2026-10-03", "Month 2 with Anyash", "This month"]);
});

test("a week report: words per area, what we heard, quotes", () => {
  const c1 = call("2026-10-01", { health: "Knee pain after cooking. Took her tablet.", followUpNeeded: "yes", followUpDetail: "Ask about the knee tomorrow." });
  const c2 = call("2026-10-02", { summary: "Cheerful, made kheer." });
  const s = buildStory({
    joinedAt: at("2026-09-20", 9),
    calls: [c1, c2],
    logs: [
      { log_date: "2026-10-01", mobility_and_pain: { pain_reported: true } },
      { log_date: "2026-10-02", mobility_and_pain: { pain_reported: false } },
    ],
    reviews: [],
    events: [{ date: "2026-10-02", category: "life", words: "Made kheer for the puja", importance: 3 }],
    threads: [{ title: "Knee pain", status: "open", importance: 4 }],
    now: NOW,
  });
  const r = buildReport(s, "week", "2026-10-03");
  assert.equal(r.daysTalked, 2);
  assert.equal(r.areas.find((a) => a.area === "body")!.word, "Pain mentioned");
  assert.equal(r.areas.find((a) => a.area === "sleep")!.word, "Not talked about");
  assert.deepEqual(r.heard[1], { what: "Knee pain after cooking. Took her tablet.", todo: "Ask about the knee tomorrow.", at: c1.at });
  assert.equal(r.heard[0].todo, "Nothing needed.");
  assert.equal(r.quotes[0].words, "Made kheer for the puja");
  assert.equal(r.next[0].title, "Knee pain");
  assert.equal(s.days.find((d) => d.key === "2026-10-02")!.moment, true);
});

test("relative times", () => {
  assert.equal(whenLabel(at("2026-10-03", 19, 10), NOW), "Today, 7:10 PM · 2 h ago");
  assert.equal(whenLabel(at("2026-10-02", 21, 41), NOW), "Yesterday, 9:41 PM");
  assert.equal(whenLabel(at("2026-09-29", 21, 48), NOW), "Last Tuesday, 9:48 PM");
});
