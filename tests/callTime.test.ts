import { test } from "node:test";
import assert from "node:assert/strict";
import * as callTime from "../lib/callTime";
import { normalizeClock, parseClock, readCallTimes } from "../lib/callTime";

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

test("there is no time-of-day limit on calls any more", () => {
  assert.equal("checkCallTime" in callTime, false);
  assert.equal("latestCallTime" in callTime, false);
});

test("readCallTimes normalises, clears and rejects", () => {
  assert.deepEqual(readCallTimes({ sleep_time: "10:30 PM", preferred_call_time: "" }), {
    values: { sleep_time: "22:30", preferred_call_time: null },
  });
  assert.deepEqual(readCallTimes({ parent_name: "x" }), { values: {} });
  assert.deepEqual(readCallTimes({ sleep_time: "late" }), { error: "sleep_time must be a time like 19:30" });
});
