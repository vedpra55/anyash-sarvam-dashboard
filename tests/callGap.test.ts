import { test } from "node:test";
import assert from "node:assert/strict";
import { dateForGap, daysBetween, lastCallDateOf, resolveCallGap } from "../lib/callGap";

test("the gap counts neither the last call's day nor today", () => {
  assert.equal(daysBetween("2026-10-06", "2026-10-09"), 2);
  assert.equal(daysBetween("2026-10-08", "2026-10-09"), 0);
  assert.equal(daysBetween("2026-10-09", "2026-10-09"), 0);
  assert.equal(daysBetween("2026-09-30", "2026-10-02"), 1);
  assert.equal(daysBetween("bad", "2026-10-09"), null);
  assert.equal(dateForGap(2, "2026-10-09"), "2026-10-06");
  assert.equal(dateForGap(0, "2026-10-01"), "2026-09-30");
});

test("last call date is the newest connected call, in India time", () => {
  const calls = [
    { created_at: "2026-10-08T10:00:00Z", call_status: "no_answer", duration_seconds: 0 },
    // 19:00 UTC on the 5th is 00:30 IST on the 6th.
    { created_at: "2026-10-05T19:00:00Z", call_status: "connected", duration_seconds: 120 },
    { created_at: "2026-10-01T10:00:00Z", call_status: "connected", duration_seconds: 90 },
  ];
  assert.equal(lastCallDateOf(calls), "2026-10-06");
  assert.equal(lastCallDateOf([]), null);
});

test("resolveCallGap: typed values win, otherwise the calls decide", () => {
  const now = Date.parse("2026-10-09T06:00:00Z");
  const calls = [{ created_at: "2026-10-06T06:00:00Z", call_status: "connected", duration_seconds: 60 }];
  assert.deepEqual(resolveCallGap({}, calls, now), { last_call_date: "2026-10-06", days_since_last_call: "2" });
  assert.deepEqual(resolveCallGap({}, [], now), { last_call_date: "", days_since_last_call: "" });
  assert.deepEqual(resolveCallGap({ last_call_date: "2026-10-01" }, calls, now), {
    last_call_date: "2026-10-01",
    days_since_last_call: "7",
  });
  assert.deepEqual(resolveCallGap({ days_since_last_call: "4" }, calls, now), {
    last_call_date: "2026-10-04",
    days_since_last_call: "4",
  });
  assert.deepEqual(resolveCallGap({ last_call_date: "2026-10-06", days_since_last_call: 5 }, [], now), {
    last_call_date: "2026-10-06",
    days_since_last_call: "5",
  });
});
