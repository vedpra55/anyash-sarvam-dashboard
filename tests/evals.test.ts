import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTotals, summarizeResults } from "../lib/evals";
import { cleanScenario } from "../lib/evalScenarioInput";
import { SEED_SCENARIOS } from "../lib/evalSeed";

test("run summary counts passed, failed, errored and pending", () => {
  const s = summarizeResults([
    { status: "done", passed: true },
    { status: "done", passed: false },
    { status: "error", passed: null },
    { status: "running", passed: null },
    { status: "queued", passed: null },
  ]);
  assert.deepEqual([s.total, s.passed, s.failed, s.errored, s.pending], [5, 1, 1, 1, 2]);
  assert.equal(s.rate, 0.5);
  assert.equal(summarizeResults([]).rate, null);
});

test("check totals ignore checks that did not apply", () => {
  const totals = checkTotals([
    { status: "done", grades: { checks: [{ id: "feelings", pass: null, reason: "" }, { id: "no_echo", pass: true, reason: "" }], criteria: [] } },
    { status: "done", grades: { checks: [{ id: "feelings", pass: false, reason: "" }, { id: "no_echo", pass: true, reason: "" }], criteria: [] } },
    { status: "error", grades: null },
  ]);
  assert.deepEqual(totals.feelings, { passed: 0, applied: 1 });
  assert.deepEqual(totals.no_echo, { passed: 2, applied: 2 });
});

test("a scenario needs a name and a persona; scripted ones need lines", () => {
  assert.ok("error" in cleanScenario({ persona: "x" }));
  assert.ok("error" in cleanScenario({ name: "x" }));
  assert.ok("error" in cleanScenario({ name: "x", persona: "y", kind: "scripted", script: "  \n" }));
  const ok = cleanScenario({
    name: " Quiet ",
    persona: "Sunita",
    kind: "scripted",
    script: "haan\n\ntheek hai",
    call_number: "-5",
    max_exchanges: 500,
    checks: ["talk_share", "bogus"],
    criteria: [{ text: "Never says normal" }, { text: " " }],
  });
  assert.ok("value" in ok);
  if (!("value" in ok)) return;
  assert.equal(ok.value.name, "Quiet");
  assert.deepEqual(ok.value.script, ["haan", "theek hai"]);
  assert.equal(ok.value.call_number, 1);
  assert.equal(ok.value.max_exchanges, 40);
  assert.deepEqual(ok.value.checks, ["talk_share"]);
  assert.deepEqual(ok.value.criteria, [{ id: "criterion_1", text: "Never says normal" }]);
});

test("every starting scenario is valid, unique and covers the Phase 4 cases", () => {
  const slugs = new Set<string>();
  for (const s of SEED_SCENARIOS) {
    assert.ok("value" in cleanScenario(s), s.slug);
    assert.ok(!slugs.has(s.slug), `duplicate ${s.slug}`);
    slugs.add(s.slug);
    assert.ok(s.criteria.length > 0 || s.checks?.length, s.slug);
  }
  for (const needed of ["chatty", "one-word", "doesnt-cook", "hard-day", "english-phrases", "telugu", "talker-4min", "tips-diabetic-low-energy", "tips-knee-week", "tips-heat", "urgent-chest-pain"]) {
    assert.ok(slugs.has(needed), `missing ${needed}`);
  }
});
