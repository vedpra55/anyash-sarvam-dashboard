import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProfileRow,
  buildStartingContext,
  normalizeIndianPhone,
  readOnboarding,
  shouldWriteStartingContext,
  validateOnboarding,
  OnboardingInput,
} from "../lib/onboarding";

const FULL: OnboardingInput = {
  parent_name: "Sunita Sharma",
  honorific: "Mummy Ji",
  language: "Hindi",
  phone_number: "98765 43210",
  child_name: "Priya",
  relationship: "Daughter",
  living_situation: "alone",
  household_help: "a cook comes in the morning",
  wake_time: "5:30 AM",
  sleep_time: "22:30",
  preferred_call_time: "18:00",
  conditions: ["High BP", " "],
  medicines: ["Amlodipine 5 mg, morning"],
  enjoys: "bhajans and her garden",
  avoid_topics: "Papa's passing last year",
  child_worry: "She hides it when she is unwell",
};

test("validation: required fields and cleaning", () => {
  const ok = validateOnboarding(FULL);
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.input.phone_number, "+919876543210");
  assert.equal(ok.input.wake_time, "05:30");
  assert.deepEqual(ok.input.conditions, ["High BP"]);

  for (const field of ["parent_name", "honorific", "language", "child_name"] as const) {
    const r = validateOnboarding({ ...FULL, [field]: "  " });
    assert.equal(r.ok, false, field);
  }
  assert.equal(validateOnboarding({ ...FULL, phone_number: "12345" }).ok, false);
  assert.equal(validateOnboarding({ ...FULL, sleep_time: "late" }).ok, false);
  assert.equal(validateOnboarding({ ...FULL, living_situation: "with_friends" as any }).ok, false);
  // Only the required fields: valid.
  const minimal = { parent_name: "A", honorific: "Amma", language: "Tamil", phone_number: "+919999999999", child_name: "B" };
  assert.equal(validateOnboarding(minimal).ok, true);
});

test("starting context follows the template", () => {
  const v = validateOnboarding(FULL);
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.equal(
    buildStartingContext(v.input),
    [
      "PERSON: Mummy Ji (Sunita Sharma); lives alone; help at home: a cook comes in the morning",
      "DAY: wakes about 5:30 AM, sleeps about 10:30 PM; best call time 6:00 PM",
      "HEALTH (from Priya, not yet confirmed by the parent): High BP; medicines: Amlodipine 5 mg, morning",
      "LIFE: enjoys bhajans and her garden",
      "AVOID: Papa's passing last year",
      'NOTE: everything above came from Priya. Confirm it gently over the calls in the parent\'s own words. Never say "your child told me".',
    ].join("\n"),
  );
});

test("empty lines and parts are skipped", () => {
  const ctx = buildStartingContext({
    parent_name: "Ramesh",
    honorific: "Papa Ji",
    language: "Hindi",
    phone_number: "+919999999999",
    child_name: "Ved",
    sleep_time: "23:00",
    medicines: ["Metformin"],
  });
  assert.equal(
    ctx,
    [
      "PERSON: Papa Ji (Ramesh)",
      "DAY: sleeps about 11:00 PM",
      "HEALTH (from Ved, not yet confirmed by the parent): medicines: Metformin",
      'NOTE: everything above came from Ved. Confirm it gently over the calls in the parent\'s own words. Never say "your child told me".',
    ].join("\n"),
  );
});

test("child_worry never reaches the starting context", () => {
  const ctx = buildStartingContext(FULL);
  assert.equal(ctx.includes("hides"), false);
  assert.equal(/worry/i.test(ctx), false);
});

test("storage: child facts are tagged, columns set, other data kept", () => {
  const v = validateOnboarding(FULL);
  assert.ok(v.ok);
  if (!v.ok) return;
  const existing = {
    facts: { language: "Hindi", some_other: 1 },
    routines: [{ time: "08:30 AM", activity: "Breakfast" }, { name: "wake", time: "04:00" }],
    medical_baseline: { medications: ["old"], target_bp: "125/80" },
  };
  const row = buildProfileRow(v.input, existing);
  assert.deepEqual(row.facts.living_situation, { value: "alone", source: "child", confirmed: false });
  assert.deepEqual(row.facts.child_worry, { value: "She hides it when she is unwell", source: "child", confirmed: false });
  assert.deepEqual(row.facts.relationship, { value: "Daughter", source: "child", confirmed: false });
  assert.equal(row.facts.some_other, 1);
  assert.equal(row.facts.language, "Hindi");
  assert.deepEqual(row.routines, [
    { name: "wake", time: "05:30", source: "child", confirmed: false },
    { name: "sleep", time: "22:30", source: "child", confirmed: false },
    { time: "08:30 AM", activity: "Breakfast" },
  ]);
  assert.deepEqual(row.medical_baseline, {
    target_bp: "125/80",
    conditions: { value: ["High BP"], source: "child", confirmed: false },
    medicines: { value: ["Amlodipine 5 mg, morning"], source: "child", confirmed: false },
  });
  assert.equal(row.language, "Hindi");
  assert.equal(row.sleep_time, "22:30");
  assert.equal(row.preferred_call_time, "18:00");
});

test("a cleared optional field is removed, not kept stale", () => {
  const v = validateOnboarding({ ...FULL, enjoys: "", avoid_topics: "" });
  assert.ok(v.ok);
  if (!v.ok) return;
  const row = buildProfileRow(v.input, { facts: { enjoys: { value: "old", source: "child", confirmed: false } } });
  assert.equal("enjoys" in row.facts, false);
  assert.equal("avoid_topics" in row.facts, false);
});

test("reading back round-trips, and older shapes still read", () => {
  const v = validateOnboarding(FULL);
  assert.ok(v.ok);
  if (!v.ok) return;
  const row = buildProfileRow(v.input);
  const back = readOnboarding({ ...row, number_of_calls: 1 });
  assert.equal(back.living_situation, "alone");
  assert.equal(back.wake_time, "05:30");
  assert.deepEqual(back.medicines, ["Amlodipine 5 mg, morning"]);
  assert.equal(back.child_worry, "She hides it when she is unwell");

  const legacy = readOnboarding({
    parent_name: "Poonam",
    facts: { language: "Hindi", relationship: "Son", family_member: "Ved" },
    medical_baseline: { conditions: ["Knee discomfort"], medications: ["Multivitamin"] },
    sleep_time: "22:30",
  });
  assert.equal(legacy.relationship, "Son");
  assert.equal(legacy.child_name, "Ved");
  assert.deepEqual(legacy.medicines, ["Multivitamin"]);
  assert.equal(legacy.sleep_time, "22:30");
});

test("starting memory is written only before the first real call", () => {
  assert.equal(shouldWriteStartingContext(null), true);
  assert.equal(shouldWriteStartingContext({ number_of_calls: 1 }), true);
  assert.equal(shouldWriteStartingContext({ number_of_calls: 2 }), false);
});

test("dashboard-edited routines replace the stored ones; absent, they are kept", () => {
  const v = validateOnboarding({ ...FULL, other_routines: [{ time: "7:00 AM", activity: "Walk" }, { time: "", activity: " " }] });
  assert.ok(v.ok);
  if (!v.ok) return;
  const row = buildProfileRow(v.input, { routines: [{ time: "08:30 AM", activity: "Breakfast" }] });
  assert.deepEqual(row.routines.slice(2), [{ time: "7:00 AM", activity: "Walk", source: "child", confirmed: false }]);
  assert.deepEqual(readOnboarding(row).other_routines, [{ time: "7:00 AM", activity: "Walk" }]);
});

test("Indian phone numbers are normalised to +91 and 10 digits", () => {
  assert.equal(normalizeIndianPhone("98765 43210"), "+919876543210");
  assert.equal(normalizeIndianPhone("09876543210"), "+919876543210");
  assert.equal(normalizeIndianPhone("919876543210"), "+919876543210");
  assert.equal(normalizeIndianPhone("+91 98765 43210"), "+919876543210");
  assert.equal(normalizeIndianPhone("+1 415 555 0100"), "+14155550100");
});
