/**
 * Insights engine and test-call rule, checked against the real trial calls
 * (times, durations, turns, endings and Call Goal results from Sarvam, 25–29 Sep
 * 2026) with parents anonymised as A, B and C.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Ledger,
  LedgerCall,
  computeInsights,
  headline,
  byCallNumber,
  findings,
  funnel,
  endings,
  speed,
  windowFor,
  istDay,
  istHour,
  median,
  percentile,
} from "../lib/insights";
import { testReason, parseSarvamTime, TRIAL_START_ISO } from "../lib/trial";

const IST = 5.5 * 3600_000;
/** "2026-09-25 20:58:53" in India time → epoch ms. */
const ist = (s: string) => Date.parse(s.replace(" ", "T") + "Z") - IST;

type Row = [parent: string, when: string, sec: number, msgs: number, end: string, goal: boolean, agent: number, user: number];
const ROWS: Row[] = [
  ["A", "2026-09-25 20:58:53", 93.1, 9, "AGENT_ENDS", true, 0.64, 1.01],
  ["A", "2026-09-26 21:38:27", 180.36, 19, "TIMEOUT", true, 0.57, 6.66],
  ["A", "2026-09-27 20:48:59", 180.32, 29, "TIMEOUT", true, 0.53, 2.84],
  ["A", "2026-09-28 22:06:54", 67.05, 17, "AGENT_ENDS", true, 0.54, 1.97],
  ["A", "2026-09-29 22:19:56", 102.5, 25, "AGENT_ENDS", true, 0.51, 2.35],
  ["B", "2026-09-25 21:44:25", 58.52, 7, "AGENT_ENDS", false, 0.57, 0.92],
  ["B", "2026-09-26 22:31:00", 150.34, 21, "AGENT_ENDS", true, 0.57, 3.7],
  ["B", "2026-09-27 22:18:47", 42.05, 3, "AGENT_ENDS", false, 0.65, 2.98],
  ["B", "2026-09-28 21:53:47", 77.22, 17, "AGENT_ENDS", true, 0.58, 2.45],
  ["B", "2026-09-29 22:06:18", 86.05, 25, "AGENT_ENDS", true, 0.58, 1.82],
  ["C", "2026-09-26 23:02:05", 87.44, 7, "AGENT_ENDS", true, 0.58, 2.42],
  ["C", "2026-09-27 22:54:05", 8.39, 1, "USER_ENDS", false, 0, 0],
  ["C", "2026-09-27 23:41:56", 11.36, 1, "AGENT_ENDS", false, 0, 0],
  ["C", "2026-09-27 23:53:35", 180.38, 27, "TIMEOUT", true, 0.55, 2.62],
  ["C", "2026-09-29 23:59:46", 10.5, 1, "AGENT_ENDS", false, 0, 0],
];

const calls: LedgerCall[] = ROWS.map(([p, when, sec, msgs, end, goal, agent, user], i) => ({
  id: `call-${i}`,
  time: ist(when),
  parentId: p,
  parentName: `Parent ${p}`,
  status: "connected",
  connected: true,
  durationSec: sec,
  messages: msgs,
  endReason: end,
  agentLatency: agent > 0 ? agent : null,
  parentLatency: user > 0 ? user : null,
  goal: goal ? "passed" : "failed",
  criteria: [{ name: "Call Goal", status: goal ? "passed" : "failed" }],
  outcome: goal ? "meaningful_checkin" : "no_conversation",
  mood: goal ? "calm_positive" : "neutral",
  openness: goal ? "answered_with_prompts" : "reluctant_or_brief",
  followUp: false,
  healthCaptured: goal,
  callNumber: null,
  decision: null,
  parentSpoke: msgs > 1,
}));

const ledger: Ledger = {
  trialStart: TRIAL_START_ISO,
  generatedAt: new Date().toISOString(),
  calls,
  parents: [
    { id: "A", name: "Parent A" },
    { id: "B", name: "Parent B" },
    { id: "C", name: "Parent C" },
  ],
  logs: [],
  followUps: [],
  excluded: { total: 21, byReason: [] },
};

const NOW = ist("2026-09-30 12:00:00");

test("India-time day and hour", () => {
  assert.equal(istDay(ist("2026-09-25 00:10:00")), "2026-09-25");
  assert.equal(istDay(ist("2026-09-24 23:59:00")), "2026-09-24");
  assert.equal(istHour(ist("2026-09-27 23:41:56")), 23);
});

test("stats helpers", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
});

test("trial window starts on 25 Sep and compares like with like", () => {
  const trial = windowFor("trial", NOW);
  assert.equal(trial.from, "2026-09-25");
  assert.equal(trial.to, "2026-09-30");
  assert.equal(trial.prev, null);
  const week = windowFor("7d", NOW);
  assert.equal(week.from, "2026-09-25"); // clipped at the trial start
  assert.equal(week.prev, null); // previous week was before the trial
});

test("headline numbers match the real trial", () => {
  const h = headline(calls, "2026-09-25", "2026-09-30", "2026-09-30");
  assert.equal(h.calls, 15);
  assert.equal(h.connected, 15);
  assert.equal(h.goalMet, 10);
  assert.equal(h.connectRate, 1);
  assert.equal(Math.round((h.goalRate || 0) * 100), 67);
  assert.equal(h.medianTalkSec, 86.05);
  // Completed days 25–29 Sep; B and A from the 25th, C from the 26th: 10 of 14 parent-days.
  assert.equal(h.coverageDays, 5);
  assert.equal(Math.round((h.coverage || 0) * 1000), 714);
});

test("funnel and endings", () => {
  const f = funnel(calls);
  assert.deepEqual(
    f.map((s) => s.count),
    [15, 15, 11, 10, 10]
  );
  const e = endings(calls);
  assert.deepEqual(e.find((x) => x.reason === "TIMEOUT")?.count, 3);
  assert.deepEqual(e.find((x) => x.reason === "USER_ENDS")?.count, 1);
  assert.deepEqual(e.find((x) => x.reason === "AGENT_ENDS")?.count, 11);
});

test("speed ignores unmeasured calls", () => {
  const s = speed(calls);
  assert.equal(s.measuredCalls, 12);
  assert.equal(s.agentMedian, 0.57);
  assert.equal(s.agentP90, 0.64);
  assert.equal(s.parentMedian, 2.435);
});

test("engagement by call number", () => {
  const curve = byCallNumber(calls);
  assert.deepEqual(
    curve.map((p) => [p.n, p.calls, p.medianMessages]),
    [
      [1, 3, 7],
      [2, 3, 19],
      [3, 3, 3],
      [4, 3, 17],
      [5, 3, 25],
    ]
  );
});

test("findings say what the data shows", () => {
  const f = findings(calls, ledger.parents);
  const byId = Object.fromEntries(f.map((x) => [x.id, x]));
  assert.match(byId["timeouts"].title, /^3 calls were cut off/);
  assert.match(byId["timeouts"].detail, /all of them were going well/);
  assert.match(byId["short-calls"].title, /^3 of 15 calls ended within 30 seconds/);
  assert.match(byId["short-calls"].detail, /2 of 3 started after 11 PM/);
  assert.match(byId["short-calls"].detail, /in 3 the parent didn't reply/);
  assert.match(byId["parent-C"].title, /Parent C: a real conversation on 2 of 5 calls/);
  assert.match(byId["best-parents"].title, /Parent A met the goal on every call/);
  assert.match(byId["familiarity"].title, /grow after the first call: 7 → 18 turns/);
  assert.match(byId["timing"].title, /between 8:48 PM and 11:59 PM/);
  // Replies are fast (0.57 s), so speed isn't a finding.
  assert.equal(byId["speed"], undefined);
  // Things to act on come first.
  assert.equal(f[0].tone, "watch");
});

test("no findings from too little data", () => {
  assert.deepEqual(findings(calls.slice(0, 3), ledger.parents), []);
});

test("computeInsights wires everything for a range", () => {
  const ins = computeInsights(ledger, "trial", NOW);
  assert.equal(ins.sample.calls, 15);
  assert.equal(ins.daily.length, 6);
  assert.deepEqual(
    ins.daily.map((d) => d.goalMet + d.talked + d.notConnected),
    [2, 3, 5, 2, 3, 0]
  );
  assert.equal(ins.short.length, 3);
  assert.equal(ins.parents[0].id, "C"); // lowest goal rate first
  assert.equal(ins.parents.find((p) => p.id === "A")?.flag?.text, "Every call met the goal");
  assert.equal(ins.criteria[0].name, "Call Goal");
  assert.equal(ins.criteria[0].passed, 10);
});

/* ------------------------------------------------------------------ */
/* Test-call rule                                                      */
/* ------------------------------------------------------------------ */

const parents = new Set(["9142348182", "6200661634", "8292768521"]);
const real = {
  attempted_at: "2026-09-28T16:36:54",
  user_contact: "+919142348182",
  channel_direction: "outbound",
  is_debug_call: 0,
  agent_variables: { parent_name: "Poonam", call_outcome: "meaningful_checkin" },
};

test("real parent calls are kept", () => {
  assert.equal(testReason(real, parents), null);
});

test("test calls are excluded with a reason", () => {
  assert.equal(testReason({ ...real, user_contact: "someone@gmail.com", channel_direction: "inbound", is_debug_call: 1 }, parents), "playground");
  assert.equal(testReason({ ...real, is_debug_call: 1 }, parents), "debug");
  assert.equal(testReason({ ...real, channel_direction: "inbound" }, parents), "inbound");
  assert.equal(testReason({ ...real, user_contact: "+919876543210" }, parents), "dummy_number");
  assert.equal(testReason({ ...real, agent_variables: { parent_name: "Test" } }, parents), "test_name");
  assert.equal(testReason({ ...real, agent_variables: { call_outcome: "test_call" } }, parents), "test_outcome");
  assert.equal(testReason({ ...real, user_contact: "+919000011111" }, parents), "unknown_number");
  // Without a parent list, unknown numbers are not judged.
  assert.equal(testReason({ ...real, user_contact: "+919000011111" }), null);
});

test("the trial starts at 25 Sep 00:00 India time", () => {
  // 24 Sep 18:29 UTC = 24 Sep 23:59 IST → before the trial.
  assert.equal(testReason({ ...real, attempted_at: "2026-09-24T18:29:00" }, parents), "before_trial");
  // 24 Sep 18:31 UTC = 25 Sep 00:01 IST → in the trial.
  assert.equal(testReason({ ...real, attempted_at: "2026-09-24T18:31:00" }, parents), null);
});

test("Sarvam times without a zone are UTC", () => {
  assert.equal(parseSarvamTime("2026-09-28T16:36:54"), Date.parse("2026-09-28T16:36:54Z"));
  assert.equal(parseSarvamTime("2026-09-28T16:36:54Z"), Date.parse("2026-09-28T16:36:54Z"));
  assert.ok(Number.isNaN(parseSarvamTime(null)));
});
