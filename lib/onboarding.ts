/**
 * The child's onboarding profile for a parent: validation, storage shape and
 * the first working memory (current_user_context) the voice agent starts from.
 *
 * Every value the child gives is stored as { value, source: "child",
 * confirmed: false }, so later calls can confirm it in the parent's own words.
 * child_worry is shown on the dashboard only and never reaches the agent.
 */
import { normalizeClock, parseClock, formatClock } from "./callTime";

export type LivingSituation = "alone" | "with_spouse" | "with_family";

/** Which parent the form is about. The child picks one; each form adds one parent. */
export type ParentRole = "mother" | "father";

export const PARENT_ROLES: { id: ParentRole; label: string }[] = [
  { id: "mother", label: "Mom" },
  { id: "father", label: "Dad" },
];

/** What a child usually calls each parent, offered as one-tap choices. */
export const HONORIFICS_BY_ROLE: Record<ParentRole, string[]> = {
  mother: ["Mummy", "Mummy Ji", "Maa", "Amma", "Mom", "Aai", "Ammi"],
  father: ["Papa", "Papa Ji", "Pitaji", "Appa", "Dad", "Baba", "Abbu"],
};

export const LIVING_SITUATIONS: { id: LivingSituation; label: string }[] = [
  { id: "alone", label: "Alone" },
  { id: "with_spouse", label: "With their husband or wife" },
  { id: "with_family", label: "With family" },
];

export const HONORIFICS = [
  "Mummy Ji",
  "Papa Ji",
  "Maa",
  "Mom",
  "Dad",
  "Amma",
  "Appa",
  "Babuji",
  "Nani Ji",
  "Nana Ji",
  "Dadi Ji",
  "Dada Ji",
];

/** What the form collects. Times are "HH:MM"; lists are one item per entry. */
export interface OnboardingInput {
  parent_name: string;
  honorific: string;
  language: string;
  phone_number: string;
  child_name: string;
  /** Mother or father. Older profiles and the dashboard may leave it empty. */
  parent_role?: ParentRole | "";
  relationship?: string;
  living_situation?: LivingSituation | "";
  household_help?: string;
  wake_time?: string;
  sleep_time?: string;
  preferred_call_time?: string;
  conditions?: string[];
  medicines?: string[];
  enjoys?: string;
  avoid_topics?: string;
  child_worry?: string;
  /**
   * Other routine entries ({ time, activity }), edited on the dashboard.
   * Left out, the stored ones are kept as they are.
   */
  other_routines?: { time: string; activity: string }[];
}

/** Questions shown to the child, keyed by field. */
export const QUESTIONS = {
  parent_name: "Your parent's full name",
  honorific: "What should Anyash call them?",
  language: "Which language do they speak most comfortably?",
  phone_number: "Their phone number",
  child_name: "Your name",
  relationship: "How are you related to them?",
  living_situation: "Who do they live with?",
  household_help: "Who cooks at home? Does anyone come to help?",
  wake_sleep: "When do they usually wake up and go to sleep?",
  preferred_call_time: "What's the best time to call them?",
  health: "Any health conditions or daily medicines?",
  enjoys: "What do they enjoy talking about?",
  avoid_topics: "Anything Anyash should not bring up?",
  child_worry: "What worries you most about them?",
} as const;

/** Health conditions offered as one-tap choices. */
export const COMMON_CONDITIONS = [
  "High BP",
  "Diabetes",
  "Thyroid",
  "Joint pain",
  "Heart condition",
  "High cholesterol",
  "Asthma",
  "Low hearing",
];

export interface ChildFact<T = string> {
  value: T;
  source: "child" | "parent";
  confirmed: boolean;
}

const fromChild = <T,>(value: T): ChildFact<T> => ({ value, source: "child", confirmed: false });

const clean = (s?: string | null) => (s || "").replace(/\s+/g, " ").trim();
const cleanList = (items?: string[] | null) => (items || []).map(clean).filter(Boolean);

export type ValidationResult =
  | { ok: true; input: Required<Omit<OnboardingInput, "other_routines">> & Pick<OnboardingInput, "other_routines"> }
  | { ok: false; error: string };

/** Checks required fields and formats, and returns a cleaned copy. */
export function validateOnboarding(raw: Partial<OnboardingInput> | null | undefined): ValidationResult {
  const r = raw || {};
  const input = {
    parent_name: clean(r.parent_name),
    honorific: clean(r.honorific),
    language: clean(r.language),
    phone_number: String(r.phone_number || "").replace(/[^\d+]/g, ""),
    child_name: clean(r.child_name),
    parent_role: (clean(r.parent_role) as ParentRole | ""),
    relationship: clean(r.relationship),
    living_situation: (clean(r.living_situation) as LivingSituation | ""),
    household_help: clean(r.household_help),
    wake_time: clean(r.wake_time),
    sleep_time: clean(r.sleep_time),
    preferred_call_time: clean(r.preferred_call_time),
    conditions: cleanList(r.conditions),
    medicines: cleanList(r.medicines),
    enjoys: clean(r.enjoys),
    avoid_topics: clean(r.avoid_topics),
    child_worry: clean(r.child_worry),
    other_routines: Array.isArray(r.other_routines)
      ? r.other_routines
          .map((x) => ({ time: clean(x?.time), activity: clean(x?.activity) }))
          .filter((x) => x.activity)
      : undefined,
  };

  const errors = onboardingErrors(input);
  const first = Object.values(errors)[0];
  if (first) return { ok: false, error: first };
  for (const field of ["wake_time", "sleep_time", "preferred_call_time"] as const) {
    if (input[field]) input[field] = normalizeClock(input[field])!;
  }
  input.phone_number = normalizeIndianPhone(input.phone_number);
  return { ok: true, input };
}

export type OnboardingErrors = Partial<Record<keyof OnboardingInput, string>>;

const TIME_LABELS = { wake_time: "Wake-up time", sleep_time: "Sleep time", preferred_call_time: "Call time" } as const;

/**
 * A message for each field that needs fixing, in the order the form asks them.
 * Lets the form show the error next to the field, before the server sees it.
 */
export function onboardingErrors(raw: Partial<OnboardingInput> | null | undefined): OnboardingErrors {
  const r = raw || {};
  const errors: OnboardingErrors = {};
  if (!clean(r.parent_name)) errors.parent_name = "Please add your parent's name.";
  if (!clean(r.honorific)) errors.honorific = "Please choose how Anyash should call them, e.g. Mummy Ji.";
  if (!clean(r.language)) errors.language = "Please choose the language they speak.";
  const phone = String(r.phone_number || "").replace(/[^\d+]/g, "");
  const digits = phone.replace(/\D/g, "");
  if (!digits || digits === "91") errors.phone_number = "Please add their phone number.";
  else if (digits.length < 10) errors.phone_number = "That number looks too short. Use 10 digits, e.g. 98765 43210.";
  else if (!isValidIndianPhone(normalizeIndianPhone(phone))) {
    errors.phone_number = "An Indian number has 10 digits after +91. Please check it, e.g. 98765 43210.";
  }
  if (!clean(r.child_name)) errors.child_name = "Please add your name.";
  const role = clean(r.parent_role);
  if (role && !PARENT_ROLES.some((p) => p.id === role)) errors.parent_role = "Please choose Mom or Dad.";
  const living = clean(r.living_situation);
  if (living && !LIVING_SITUATIONS.some((l) => l.id === living)) errors.living_situation = "Please choose who they live with.";
  for (const field of ["wake_time", "sleep_time", "preferred_call_time"] as const) {
    const value = clean(r[field]);
    if (value && !normalizeClock(value)) errors[field] = `${TIME_LABELS[field]} should be a time like 7:30 AM.`;
  }
  return errors;
}

/**
 * +91 numbers need exactly 10 digits after the code (mobiles and landlines with
 * their STD code). Numbers from other countries only need 10 or more digits.
 */
export function isValidIndianPhone(phone: string): boolean {
  if (!phone.startsWith("+91")) return phone.replace(/\D/g, "").length >= 10;
  return /^\+91\d{10}$/.test(phone);
}

/** The 10 local digits of an Indian number typed or pasted with +91, 91 or 0 in front. */
export function localIndianDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

/**
 * "+91" plus the 10-digit number for Indian numbers typed as 10 digits, with a
 * leading 0, or with 91 and no plus. Numbers already starting with + are kept.
 */
export function normalizeIndianPhone(raw: string): string {
  if (raw.startsWith("+")) return `+${raw.replace(/\D/g, "")}`;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

function livingLabel(value?: string): string {
  if (value === "alone") return "alone";
  if (value === "with_spouse") return "with spouse";
  if (value === "with_family") return "with family";
  return "";
}

function clockLabel(value?: string): string {
  const minutes = parseClock(value);
  return minutes === null ? "" : formatClock(minutes);
}

/** Joins the non-empty parts of a line; returns "" when every part is empty. */
function line(label: string, parts: string[]): string {
  const kept = parts.filter(Boolean);
  return kept.length ? `${label}: ${kept.join("; ")}` : "";
}

/**
 * The first working memory, from the child's answers. Lines and parts with no
 * value are left out. child_worry is never included.
 */
export function buildStartingContext(input: OnboardingInput): string {
  const living = livingLabel(input.living_situation || "");
  const help = clean(input.household_help);
  const conditions = cleanList(input.conditions).join(", ");
  const medicines = cleanList(input.medicines).join(", ");
  const child = clean(input.child_name) || "the family";

  const role = input.parent_role === "mother" ? "mother" : input.parent_role === "father" ? "father" : "";
  const lines = [
    line("PERSON", [
      `${clean(input.honorific)} (${clean(input.parent_name)})${role && clean(input.child_name) ? `, ${clean(input.child_name)}'s ${role}` : ""}`,
      living ? `lives ${living}` : "",
      help ? `help at home: ${help}` : "",
    ]),
    line("DAY", [
      [
        clockLabel(input.wake_time) ? `wakes about ${clockLabel(input.wake_time)}` : "",
        clockLabel(input.sleep_time) ? `sleeps about ${clockLabel(input.sleep_time)}` : "",
      ]
        .filter(Boolean)
        .join(", "),
      clockLabel(input.preferred_call_time) ? `best call time ${clockLabel(input.preferred_call_time)}` : "",
    ]),
    conditions || medicines
      ? `HEALTH (from ${child}, not yet confirmed by the parent): ${[conditions, medicines ? `medicines: ${medicines}` : ""]
          .filter(Boolean)
          .join("; ")}`
      : "",
    clean(input.enjoys) ? `LIFE: enjoys ${clean(input.enjoys)}` : "",
    clean(input.avoid_topics) ? `AVOID: ${clean(input.avoid_topics)}` : "",
    `NOTE: everything above came from ${child}. Confirm it gently over the calls in the parent's own words. Never say "your child told me".`,
  ];
  return lines.filter(Boolean).join("\n");
}

export interface ProfileRow {
  parent_name: string;
  honorific: string;
  phone_number: string;
  child_name: string;
  language: string;
  preferred_call_time: string | null;
  sleep_time: string | null;
  facts: Record<string, unknown>;
  routines: Record<string, unknown>[];
  medical_baseline: Record<string, unknown>;
}

const isOnboardingRoutine = (r: any) => r?.name === "wake" || r?.name === "sleep";

/**
 * The parent_profiles columns for this input. Existing facts and routines the
 * form does not cover are kept (e.g. routines a call recorded).
 */
export function buildProfileRow(
  input: OnboardingInput,
  existing?: { facts?: any; routines?: any; medical_baseline?: any } | null,
): ProfileRow {
  const facts: Record<string, unknown> = { ...(existing?.facts || {}) };
  const setFact = (key: string, value: string) => {
    if (value) facts[key] = fromChild(value);
    else delete facts[key];
  };
  setFact("relationship", clean(input.relationship));
  setFact("parent_role", clean(input.parent_role));
  setFact("living_situation", clean(input.living_situation));
  setFact("household_help", clean(input.household_help));
  setFact("enjoys", clean(input.enjoys));
  setFact("avoid_topics", clean(input.avoid_topics));
  setFact("child_worry", clean(input.child_worry));
  // Plain copies read by older screens.
  facts.language = clean(input.language);
  facts.family_member = clean(input.child_name);

  const kept = input.other_routines
    ? input.other_routines.map((r) => ({ ...r, source: "child", confirmed: false }))
    : Array.isArray(existing?.routines)
      ? existing!.routines.filter((r: any) => !isOnboardingRoutine(r))
      : [];
  const routines: Record<string, unknown>[] = [];
  if (input.wake_time) routines.push({ name: "wake", time: input.wake_time, source: "child", confirmed: false });
  if (input.sleep_time) routines.push({ name: "sleep", time: input.sleep_time, source: "child", confirmed: false });

  const medical: Record<string, unknown> = { ...(existing?.medical_baseline || {}) };
  delete medical.medications; // superseded by medicines
  const conditions = cleanList(input.conditions);
  const medicines = cleanList(input.medicines);
  if (conditions.length) medical.conditions = fromChild(conditions);
  else delete medical.conditions;
  if (medicines.length) medical.medicines = fromChild(medicines);
  else delete medical.medicines;

  return {
    parent_name: clean(input.parent_name),
    honorific: clean(input.honorific),
    phone_number: input.phone_number,
    child_name: clean(input.child_name),
    language: clean(input.language),
    preferred_call_time: input.preferred_call_time || null,
    sleep_time: input.sleep_time || null,
    facts,
    routines: [...routines, ...kept],
    medical_baseline: medical,
  };
}

/* ------------------------------------------------------------------ */
/* Reading a stored profile back (new and older shapes)                */
/* ------------------------------------------------------------------ */

/** A fact's value, whether stored as { value, ... } or as a plain value. */
export function factValue<T = string>(fact: unknown): T | undefined {
  if (fact && typeof fact === "object" && !Array.isArray(fact) && "value" in (fact as any)) {
    return (fact as any).value as T;
  }
  return (fact ?? undefined) as T | undefined;
}

function toStringList(value: unknown): string[] {
  const v = factValue<unknown>(value);
  if (Array.isArray(v)) {
    return v
      .map((x: any) => (typeof x === "string" ? x : x?.name ? `${x.name}${x.dosage ? ` ${x.dosage}` : ""}` : ""))
      .map(clean)
      .filter(Boolean);
  }
  if (typeof v === "string") return v.split(/[,;\n]+/).map(clean).filter(Boolean);
  return [];
}

/** The onboarding form's values for a stored parent row. */
export function readOnboarding(parent: any): OnboardingInput {
  const facts = parent?.facts || {};
  const routines: any[] = Array.isArray(parent?.routines) ? parent.routines : [];
  const routineTime = (name: string) => normalizeClock(routines.find((r) => r?.name === name)?.time) || "";
  const medical = parent?.medical_baseline || {};
  return {
    parent_name: parent?.parent_name || "",
    honorific: parent?.honorific || "",
    language: parent?.language || factValue<string>(facts.language) || "Hindi",
    phone_number: parent?.phone_number || "",
    child_name: parent?.child_name || factValue<string>(facts.family_member) || "",
    parent_role: (factValue<string>(facts.parent_role) as ParentRole) || "",
    relationship: factValue<string>(facts.relationship) || "",
    living_situation: (factValue<string>(facts.living_situation) as LivingSituation) || "",
    household_help: factValue<string>(facts.household_help) || "",
    wake_time: routineTime("wake"),
    sleep_time: normalizeClock(parent?.sleep_time) || routineTime("sleep"),
    preferred_call_time: normalizeClock(parent?.preferred_call_time) || "",
    conditions: toStringList(medical.conditions),
    medicines: toStringList(medical.medicines ?? medical.medications),
    enjoys: factValue<string>(facts.enjoys) || "",
    avoid_topics: factValue<string>(facts.avoid_topics) || "",
    child_worry: factValue<string>(facts.child_worry) || "",
    other_routines: routines
      .filter((r) => !isOnboardingRoutine(r) && r?.activity)
      .map((r) => ({ time: r.time && r.time !== "Daily Routine" ? String(r.time) : "", activity: String(r.activity) })),
  };
}

/**
 * Whether saving the form should (re)write the starting memory: only before
 * the first real call, so a memory built from calls is never overwritten.
 * number_of_calls is the number of the next call and only grows on real calls.
 */
export function shouldWriteStartingContext(parent: { number_of_calls?: number | null } | null | undefined): boolean {
  return !parent || !(Number(parent.number_of_calls) > 1);
}

/* ------------------------------------------------------------------ */
/* Living profile (profile_facts, Phase 3)                              */
/* ------------------------------------------------------------------ */

export interface FactRow {
  id: string;
  block: string;
  key: string;
  value: string;
  source: "child" | "parent";
}

/** Keys the onboarding form owns in profile_facts. child_worry is never one. */
export const ONBOARDING_FACT_KEYS = [
  "person/address_as",
  "person/language",
  "person/child",
  "household/living_situation",
  "household/household_help",
  "routine/wake_time",
  "routine/sleep_time",
  "routine/preferred_call_time",
  "health/conditions",
  "health/medicines",
  "likes/enjoys",
  "sensitivities/avoid_topics",
] as const;

/** The form's answers as living-profile facts, in the same shape the migration seeded. */
export function onboardingFacts(input: OnboardingInput): { block: string; key: string; value: string }[] {
  const child = clean(input.child_name);
  const relation = clean(input.relationship).toLowerCase();
  const values: Record<(typeof ONBOARDING_FACT_KEYS)[number], string> = {
    "person/address_as": clean(input.honorific),
    "person/language": clean(input.language),
    "person/child": child ? (relation ? `${child} (${relation})` : child) : "",
    "household/living_situation": clean(input.living_situation).replace(/_/g, " "),
    "household/household_help": clean(input.household_help),
    "routine/wake_time": clean(input.wake_time),
    "routine/sleep_time": clean(input.sleep_time),
    "routine/preferred_call_time": clean(input.preferred_call_time),
    "health/conditions": cleanList(input.conditions).join("; "),
    "health/medicines": cleanList(input.medicines).join("; "),
    "likes/enjoys": clean(input.enjoys),
    "sensitivities/avoid_topics": clean(input.avoid_topics),
  };
  return ONBOARDING_FACT_KEYS.filter((k) => values[k]).map((k) => {
    const [block, key] = k.split("/");
    return { block, key, value: values[k] };
  });
}

/**
 * What saving the form changes in the living profile. Facts are never deleted:
 * a changed or cleared answer closes the family's old fact, and a fact the
 * parent has said in their own words is never replaced by the form.
 */
export function planFactSync(
  desired: { block: string; key: string; value: string }[],
  current: FactRow[],
): { insert: { block: string; key: string; value: string }[]; close: string[] } {
  const byKey = new Map(current.map((f) => [`${f.block}/${f.key}`, f]));
  const wanted = new Map(desired.map((d) => [`${d.block}/${d.key}`, d]));
  const insert: { block: string; key: string; value: string }[] = [];
  const close: string[] = [];
  for (const k of ONBOARDING_FACT_KEYS) {
    const now = byKey.get(k);
    const want = wanted.get(k);
    if (now?.source === "parent") continue;
    if (now && want && clean(now.value) === want.value) continue;
    if (now) close.push(now.id);
    if (want) insert.push(want);
  }
  return { insert, close };
}
