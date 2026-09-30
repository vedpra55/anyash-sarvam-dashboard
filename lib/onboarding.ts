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

export const LIVING_SITUATIONS: { id: LivingSituation; label: string }[] = [
  { id: "alone", label: "Akele (alone)" },
  { id: "with_spouse", label: "Pati / patni ke saath (with spouse)" },
  { id: "with_family", label: "Parivaar ke saath (with family)" },
];

export const HONORIFICS = ["Mummy Ji", "Papa Ji", "Amma", "Appa", "Maa", "Babuji", "Nani Ji", "Dadi Ji", "Nana Ji", "Dada Ji"];

/** What the form collects. Times are "HH:MM"; lists are one item per entry. */
export interface OnboardingInput {
  parent_name: string;
  honorific: string;
  language: string;
  phone_number: string;
  child_name: string;
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

/** Hinglish questions shown to the child, keyed by field. */
export const QUESTIONS = {
  parent_name: "Mummy/Papa ka naam",
  honorific: "Anyash unhe kya bulaye? (Mummy Ji, Papa Ji, Amma…)",
  language: "Woh kis bhasha mein baat karte hain?",
  phone_number: "Unka phone number",
  child_name: "Aapka naam",
  relationship: "Aap unke kya lagte hain?",
  living_situation: "Mummy/Papa kiske saath rehte hain?",
  household_help: "Ghar pe khana kaun banata hai? Koi madad ke liye aata hai?",
  wake_sleep: "Woh roz kitne baje uthte aur sote hain?",
  preferred_call_time: "Unhe kis time call karna sabse achha rahega?",
  health: "Koi health condition ya roz ki dawai?",
  enjoys: "Unhe kya pasand hai, kis baare mein baat karna achha lagta hai?",
  avoid_topics: "Kuch aisa jo hume unse nahi poochna chahiye?",
  child_worry: "Aapko unke baare mein sabse zyada kis baat ki chinta hai?",
} as const;

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

  if (!input.parent_name) return { ok: false, error: "Add the parent's name." };
  if (!input.honorific) return { ok: false, error: "Add how Anyash should address them, e.g. Mummy Ji." };
  if (!input.language) return { ok: false, error: "Choose the language they speak." };
  if (input.phone_number.replace(/\D/g, "").length < 10) {
    return { ok: false, error: "Add a full phone number, e.g. +91 98765 43210." };
  }
  if (!input.child_name) return { ok: false, error: "Add your name." };
  if (input.living_situation && !LIVING_SITUATIONS.some((l) => l.id === input.living_situation)) {
    return { ok: false, error: "Choose who they live with." };
  }
  for (const field of ["wake_time", "sleep_time", "preferred_call_time"] as const) {
    if (!input[field]) continue;
    const clock = normalizeClock(input[field]);
    if (!clock) return { ok: false, error: `${field.replace(/_/g, " ")} must be a time like 07:30.` };
    input[field] = clock;
  }
  input.phone_number = normalizeIndianPhone(input.phone_number);
  return { ok: true, input };
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

  const lines = [
    line("PERSON", [
      `${clean(input.honorific)} (${clean(input.parent_name)})`,
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
