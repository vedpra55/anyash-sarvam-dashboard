import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseUserContext, parseBriefMode } from "../lib/briefs";
import { onboardingFacts, planFactSync, validateOnboarding, FactRow, OnboardingInput } from "../lib/onboarding";

const brief = { briefId: "b1", brief: "Sunita lives alone ...", callNumber: 5 };

test("brief mode: stored JSON string, unknown means shadow", () => {
  assert.equal(parseBriefMode('"live"'), "live");
  assert.equal(parseBriefMode("live"), "live");
  assert.equal(parseBriefMode("off"), "off");
  assert.equal(parseBriefMode(null), "shadow");
  assert.equal(parseBriefMode("something"), "shadow");
});

test("shadow sends the old context even when a brief exists", () => {
  assert.deepEqual(chooseUserContext({ mode: "shadow", brief, oldContext: "OLD" }), { context: "OLD", usedBrief: false });
});

test("live sends the brief, and the old context if there is none", () => {
  assert.deepEqual(chooseUserContext({ mode: "live", brief, oldContext: "OLD" }), { context: brief.brief, usedBrief: true });
  assert.deepEqual(chooseUserContext({ mode: "live", brief: null, oldContext: "OLD" }), { context: "OLD", usedBrief: false });
});

test("a manual override always wins", () => {
  assert.deepEqual(chooseUserContext({ mode: "live", brief, oldContext: "OLD", override: " TEST " }), { context: "TEST", usedBrief: false });
});

// ---- living profile sync ------------------------------------------------------

const FORM: OnboardingInput = {
  parent_name: "Sunita Sharma",
  honorific: "Mummy Ji",
  language: "Hindi",
  phone_number: "98765 43210",
  child_name: "Priya",
  relationship: "Daughter",
  living_situation: "alone",
  wake_time: "5:30 AM",
  sleep_time: "22:30",
  conditions: ["High BP"],
  medicines: ["Amlodipine 5 mg, morning"],
  avoid_topics: "Papa's passing last year",
  child_worry: "She hides it when she is unwell",
};

function input(over: Partial<OnboardingInput> = {}) {
  const v = validateOnboarding({ ...FORM, ...over });
  assert.ok(v.ok);
  return v.input as OnboardingInput;
}

test("onboarding facts: seeded shape, never child_worry", () => {
  const facts = onboardingFacts(input());
  const byKey = Object.fromEntries(facts.map((f) => [`${f.block}/${f.key}`, f.value]));
  assert.equal(byKey["person/child"], "Priya (daughter)");
  assert.equal(byKey["routine/wake_time"], "05:30");
  assert.equal(byKey["health/conditions"], "High BP");
  assert.ok(!JSON.stringify(facts).includes("hides it"));
  assert.ok(!facts.some((f) => f.key === "child_worry"));
});

const row = (id: string, k: string, value: string, source: "child" | "parent" = "child"): FactRow => {
  const [block, key] = k.split("/");
  return { id, block, key, value, source };
};

test("fact sync: new facts added, unchanged left alone", () => {
  const desired = onboardingFacts(input());
  const first = planFactSync(desired, []);
  assert.equal(first.insert.length, desired.length);
  assert.deepEqual(first.close, []);

  const current = desired.map((d, i) => row(`f${i}`, `${d.block}/${d.key}`, d.value));
  assert.deepEqual(planFactSync(desired, current), { insert: [], close: [] });
});

test("fact sync: a changed or cleared answer closes the old fact; parent facts are kept", () => {
  const current = [
    row("wake", "routine/wake_time", "05:30"),
    row("avoid", "sensitivities/avoid_topics", "Papa's passing last year"),
    row("sleep", "routine/sleep_time", "22:00", "parent"),
    row("hobby", "likes/gardening", "roses", "parent"),
  ];
  const plan = planFactSync(onboardingFacts(input({ wake_time: "06:00", avoid_topics: "" })), current);
  assert.deepEqual(plan.close.sort(), ["avoid", "wake"]);
  assert.ok(plan.insert.some((f) => f.key === "wake_time" && f.value === "06:00"));
  assert.ok(!plan.insert.some((f) => f.key === "sleep_time")); // the parent said 22:00
  assert.ok(!plan.close.includes("hobby"));
});
