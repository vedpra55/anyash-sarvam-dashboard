import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCallTime, latestCallTime, normalizeClock, parseClock, readCallTimes } from "../lib/callTime";

/** "22:40" India time on 30 Sep 2026 -> Date. */
const ist = (hhmm: string, day = "2026-09-30") => new Date(Date.parse(`${day}T${hhmm}:00+05:30`));

test("parseClock accepts 24h and 12h forms", () => {
  assert.equal(parseClock("21:30"), 21 * 60 + 30);
  assert.equal(parseClock("9:05"), 9 * 60 + 5);
  assert.equal(parseClock("10:30 PM"), 22 * 60 + 30);
  assert.equal(parseClock("12:15 am"), 15);
  assert.equal(parseClock("21:30:00"), 21 * 60 + 30);
  assert.equal(parseClock("25:00"), null);
  assert.equal(parseClock("9pm"), null);
  assert.equal(parseClock(""), null);
  assert.equal(normalizeClock("7:05 pm"), "19:05");
});

test("latest call time is an hour before sleep, else preferred + 90 min", () => {
  assert.deepEqual(latestCallTime("22:30", "19:00"), { minutes: 21 * 60 + 30, clock: "21:30", basis: "sleep_time" });
  assert.deepEqual(latestCallTime("", "19:00"), { minutes: 20 * 60 + 30, clock: "20:30", basis: "preferred_call_time" });
  assert.equal(latestCallTime(null, null), null);
  // Sleeping after midnight: latest is 23:30 the evening before.
  assert.equal(latestCallTime("00:30", null)!.clock, "23:30");
});

test("the 10:19 PM and 11:59 PM calls are refused for a 10:30 PM sleeper", () => {
  const parent = { parent_name: "Poonam", sleep_time: "22:30", preferred_call_time: "19:00" };
  for (const t of ["22:19", "23:59"]) {
    const r = checkCallTime(parent, ist(t));
    assert.equal(r.allowed, false, t);
    if (!r.allowed) assert.match(r.reason, /latest call time is 9:30 PM \(an hour before their 10:30 PM bedtime\)/);
  }
  assert.equal(checkCallTime(parent, ist("21:30")).allowed, true);
  assert.equal(checkCallTime(parent, ist("19:00")).allowed, true);
});

test("after midnight counts as late night, the morning is allowed", () => {
  const parent = { sleep_time: "22:30" };
  assert.equal(checkCallTime(parent, ist("01:00")).allowed, false);
  assert.equal(checkCallTime(parent, ist("04:59")).allowed, false);
  assert.equal(checkCallTime(parent, ist("05:00")).allowed, true);
  assert.equal(checkCallTime(parent, ist("10:00")).allowed, true);
});

test("no times set means no limit", () => {
  assert.equal(checkCallTime({}, ist("23:59")).allowed, true);
});

test("preferred call time only: 7 PM call time allows until 8:30 PM", () => {
  const parent = { parent_name: "Nisha", preferred_call_time: "19:00" };
  assert.equal(checkCallTime(parent, ist("20:30")).allowed, true);
  const late = checkCallTime(parent, ist("20:31"));
  assert.equal(late.allowed, false);
  if (!late.allowed) assert.match(late.reason, /90 minutes after their 7:00 PM call time/);
});

test("readCallTimes normalises, clears and rejects", () => {
  assert.deepEqual(readCallTimes({ sleep_time: "10:30 PM", preferred_call_time: "" }), {
    values: { sleep_time: "22:30", preferred_call_time: null },
  });
  assert.deepEqual(readCallTimes({ parent_name: "x" }), { values: {} });
  assert.deepEqual(readCallTimes({ sleep_time: "late" }), { error: "sleep_time must be a time like 19:30" });
});
