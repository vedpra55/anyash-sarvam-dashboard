"use client";

import React from "react";
import { Home, User, Users } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";
import {
  COMMON_CONDITIONS,
  HONORIFICS_BY_ROLE,
  LivingSituation,
  OnboardingErrors,
  OnboardingInput,
  ParentRole,
} from "@/lib/onboarding";
import { Art, ArtName } from "./art";
import { Chip, FieldError, LineList, MultiChips, OptionCard, PhoneField, TextAreaField, TextField, TimeChoice, clock12 } from "./ui";

/* ------------------------------------------------------------------ */
/* Order                                                               */
/* ------------------------------------------------------------------ */

export type StepKey =
  | "child_name"
  | "role"
  | "parent_name"
  | "honorific"
  | "phone"
  | "language"
  | "call_time"
  | "living"
  | "wake"
  | "sleep"
  | "conditions"
  | "medicines"
  | "enjoys"
  | "avoid"
  | "worry";

/** Asked of everyone, one per screen. */
export const REQUIRED_STEPS: StepKey[] = ["child_name", "role", "parent_name", "honorific", "phone", "language", "call_time"];
/** Offered after the required ones; each can be skipped. */
export const EXTRA_STEPS: StepKey[] = ["living", "wake", "sleep", "conditions", "medicines", "enjoys", "avoid", "worry"];

/** The form fields each step fills, for its errors and for "has an answer". */
export const STEP_FIELDS: Record<StepKey, (keyof OnboardingInput)[]> = {
  child_name: ["child_name"],
  role: ["parent_role"],
  parent_name: ["parent_name"],
  honorific: ["honorific"],
  phone: ["phone_number"],
  language: ["language"],
  call_time: ["preferred_call_time"],
  living: ["living_situation"],
  wake: ["wake_time"],
  sleep: ["sleep_time"],
  conditions: ["conditions"],
  medicines: ["medicines"],
  enjoys: ["enjoys"],
  avoid: ["avoid_topics"],
  worry: ["child_worry"],
};

/** Steps that can be left empty. */
export const OPTIONAL_STEPS = new Set<StepKey>(["call_time", ...EXTRA_STEPS]);

export function hasAnswer(step: StepKey, form: OnboardingInput): boolean {
  return STEP_FIELDS[step].some((f) => {
    const v = form[f];
    return Array.isArray(v) ? v.some((x) => typeof x === "string" && x.trim()) : typeof v === "string" && v.trim() !== "";
  });
}

/** Errors to show for a step. The public form also needs Mom or Dad. */
export function stepErrors(step: StepKey, form: OnboardingInput, errors: OnboardingErrors): OnboardingErrors {
  const out: OnboardingErrors = {};
  for (const f of STEP_FIELDS[step]) if (errors[f]) out[f] = errors[f];
  if (step === "role" && !form.parent_role) out.parent_role = "Please choose Mom or Dad.";
  return out;
}

/* ------------------------------------------------------------------ */
/* Words that follow the Mom / Dad choice                              */
/* ------------------------------------------------------------------ */

export interface Words {
  /** "your mom" / "your dad" / "your parent" */
  parent: string;
  /** "Mom" / "Dad" */
  short: string;
  she: string;
  her: string;
  /** possessive: "her" / "his" / "their" */
  hers: string;
  /** What the child calls them, else "your mom". */
  name: string;
  /** "she's" / "he's" / "they're" */
  shes: string;
  /** The other parent: "Dad" for a mother. */
  spouse: string;
}

export function wordsFor(form: OnboardingInput): Words {
  const role = form.parent_role;
  const honorific = form.honorific.trim();
  if (role === "mother")
    return { parent: "your mom", short: "Mom", she: "she", her: "her", hers: "her", shes: "she's", name: honorific || "your mom", spouse: "Dad" };
  if (role === "father")
    return { parent: "your dad", short: "Dad", she: "he", her: "him", hers: "his", shes: "he's", name: honorific || "your dad", spouse: "Mom" };
  return { parent: "your parent", short: "Parent", she: "they", her: "them", hers: "their", shes: "they're", name: honorific || "your parent", spouse: "their partner" };
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ */
/* One question                                                        */
/* ------------------------------------------------------------------ */

export interface StepProps {
  form: OnboardingInput;
  errors: OnboardingErrors;
  set: <K extends keyof OnboardingInput>(key: K, v: OnboardingInput[K]) => void;
  /** Sets values and moves on after a short pause (one-tap answers). */
  pick: (patch: Partial<OnboardingInput>) => void;
  w: Words;
}

export interface StepView {
  art: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  body: React.ReactNode;
}

const art = (name: ArtName) => <Art name={name} className="w-full h-full" />;

export function stepView(step: StepKey, p: StepProps): StepView {
  const { form, errors, set, pick, w } = p;
  switch (step) {
    case "child_name":
      return {
        art: art("name"),
        title: "First, what's your name?",
        subtitle: "So Anyash knows who added your parent.",
        body: (
          <>
            <label htmlFor="ob-child" className="sr-only">Your name</label>
            <TextField
              id="ob-child"
              name="child_name"
              value={form.child_name}
              placeholder="e.g. Priya"
              autoComplete="given-name"
              autoCapitalize="words"
              enterKeyHint="next"
              invalid={Boolean(errors.child_name)}
              aria-describedby={errors.child_name ? "ob-err" : undefined}
              onChange={(e) => set("child_name", e.target.value)}
            />
            <FieldError id="ob-err">{errors.child_name}</FieldError>
          </>
        ),
      };

    case "role":
      return {
        art: null,
        title: "Who would you like Anyash to call?",
        subtitle: "Pick one parent. You can add the other with a new link later.",
        body: (
          <>
            <div role="radiogroup" aria-label="Who would you like Anyash to call?" className="grid grid-cols-2 gap-3">
              {(["mother", "father"] as ParentRole[]).map((role) => {
                const selected = form.parent_role === role;
                return (
                  <button
                    key={role}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      // Switching parent clears what you call them, which belonged to the other one.
                      pick(form.parent_role && form.parent_role !== role ? { parent_role: role, honorific: "" } : { parent_role: role })
                    }
                    className={`relative flex flex-col items-center pt-4 pb-5 rounded-[24px] border transition-[border-color,background-color,box-shadow,transform] active:scale-[0.98] ${
                      selected ? "border-ob-brand bg-ob-brand/[0.05] ring-2 ring-ob-brand animate-ob-tap motion-reduce:animate-none" : "border-ob-line bg-ob-card hover:border-ob-brand/40"
                    }`}
                  >
                    <span className="w-28 h-28 sm:w-32 sm:h-32">
                      <Art name={role === "mother" ? "mom" : "dad"} className="w-full h-full" />
                    </span>
                    <span className={`mt-2 text-[20px] font-bold ${selected ? "text-ob-brand" : "text-ob-ink"}`}>{role === "mother" ? "Mom" : "Dad"}</span>
                    <span
                      aria-hidden
                      className={`absolute top-3 right-3 w-6 h-6 rounded-full border flex items-center justify-center ${selected ? "border-ob-brand bg-ob-brand" : "border-ob-line bg-ob-card"}`}
                    >
                      {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <FieldError>{errors.parent_role}</FieldError>
          </>
        ),
      };

    case "parent_name":
      return {
        art: art(form.parent_role === "father" ? "dad" : "mom"),
        title: `What's ${w.parent}'s name?`,
        subtitle: `${cap(w.hers)} full name, as ${w.she} would write it.`,
        body: (
          <>
            <label htmlFor="ob-parent" className="sr-only">{`${cap(w.parent)}'s name`}</label>
            <TextField
              id="ob-parent"
              name="parent_name"
              value={form.parent_name}
              placeholder={form.parent_role === "father" ? "e.g. Ramesh Sharma" : "e.g. Sunita Sharma"}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              invalid={Boolean(errors.parent_name)}
              aria-describedby={errors.parent_name ? "ob-err" : undefined}
              onChange={(e) => set("parent_name", e.target.value)}
            />
            <FieldError id="ob-err">{errors.parent_name}</FieldError>
          </>
        ),
      };

    case "honorific": {
      const options = HONORIFICS_BY_ROLE[(form.parent_role || "mother") as ParentRole];
      return {
        art: art("chat"),
        title: `What do you call ${w.her}?`,
        subtitle: (
          <>
            Anyash will greet {w.her} the same way, like{" "}
            <span className="font-script text-[22px] leading-none text-ob-brand whitespace-nowrap">“Namaste {form.honorific.trim() || options[0]}!”</span>
          </>
        ),
        body: <HonorificPicker options={options} value={form.honorific} set={set} pick={pick} error={errors.honorific} />,
      };
    }

    case "phone":
      return {
        art: art("phone"),
        title: `What's ${w.name}'s phone number?`,
        subtitle: "Anyash will call this number. A mobile or a landline with its area code both work.",
        body: (
          <>
            <label htmlFor="ob-phone" className="sr-only">Phone number</label>
            <PhoneField
              id="ob-phone"
              value={form.phone_number}
              invalid={Boolean(errors.phone_number)}
              describedBy={errors.phone_number ? "ob-err" : undefined}
              onChange={(v) => set("phone_number", v)}
            />
            <FieldError id="ob-err">{errors.phone_number}</FieldError>
          </>
        ),
      };

    case "language":
      return {
        art: art("language"),
        title: `Which language is ${w.name} most comfortable in?`,
        subtitle: `Anyash will talk to ${w.her} in this language.`,
        body: (
          <>
            <div role="radiogroup" aria-label="Language" className="grid grid-cols-2 gap-2.5">
              {LANGUAGES.map((l) => (
                <Chip
                  key={l.id}
                  selected={form.language === l.id}
                  sub={l.nativeName !== l.label ? l.nativeName : " "}
                  onClick={() => pick({ language: l.id })}
                  className="!min-h-[64px]"
                >
                  {l.label}
                </Chip>
              ))}
            </div>
            <FieldError>{errors.language}</FieldError>
          </>
        ),
      };

    case "call_time":
      return {
        art: art("clock"),
        title: `When's the best time to call ${w.her}?`,
        subtitle: `A time ${w.shes} usually free and relaxed. Not sure? Skip it.`,
        body: (
          <>
            <TimeChoice
              label="Best time to call"
              presets={[
                { time: "10:00", label: "Morning" },
                { time: "13:00", label: "Afternoon" },
                { time: "18:00", label: "Evening" },
                { time: "20:00", label: "Night" },
              ]}
              value={form.preferred_call_time || ""}
              onPick={(v) => (v ? pick({ preferred_call_time: v }) : set("preferred_call_time", ""))}
            />
            <FieldError>{errors.preferred_call_time}</FieldError>
          </>
        ),
      };

    case "living": {
      const icon = (I: typeof User) => (
        <span className="w-11 h-11 rounded-xl bg-ob-mint text-ob-brand flex items-center justify-center shrink-0">
          <I className="w-5 h-5" aria-hidden />
        </span>
      );
      const options: { id: LivingSituation; title: string; hint: string; leading: React.ReactNode }[] = [
        { id: "alone", title: "Alone", hint: `${cap(w.she)} ${w.she === "they" ? "live" : "lives"} on ${w.hers} own`, leading: icon(User) },
        { id: "with_spouse", title: `With ${w.spouse}`, hint: "Just the two of them", leading: icon(Users) },
        { id: "with_family", title: "With family", hint: "Children, grandchildren or others", leading: icon(Home) },
      ];
      return {
        art: art("home"),
        title: `Who does ${w.name} live with?`,
        subtitle: "This helps Anyash ask the right things, like who cooked today.",
        body: (
          <div role="radiogroup" aria-label="Who do they live with?" className="space-y-2.5">
            {options.map((o) => (
              <OptionCard
                key={o.id}
                selected={form.living_situation === o.id}
                onClick={() => (form.living_situation === o.id ? set("living_situation", "") : pick({ living_situation: o.id }))}
                title={o.title}
                hint={o.hint}
                leading={o.leading}
              />
            ))}
          </div>
        ),
      };
    }

    case "wake":
      return {
        art: (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/onboard/sun.webp" alt="" width={320} height={320} className="w-full h-full object-contain p-3" />
        ),
        title: `When does ${w.name} usually wake up?`,
        body: (
          <TimeChoice
            label="Wakes up at"
            presets={[{ time: "05:00" }, { time: "06:00" }, { time: "07:00" }, { time: "08:00" }]}
            value={form.wake_time || ""}
            onPick={(v) => (v ? pick({ wake_time: v }) : set("wake_time", ""))}
          />
        ),
      };

    case "sleep":
      return {
        art: art("moon"),
        title: `And when does ${w.she} go to sleep?`,
        body: (
          <TimeChoice
            label="Goes to sleep at"
            presets={[{ time: "21:00" }, { time: "22:00" }, { time: "23:00" }, { time: "23:30" }]}
            value={form.sleep_time || ""}
            onPick={(v) => (v ? pick({ sleep_time: v }) : set("sleep_time", ""))}
          />
        ),
      };

    case "conditions":
      return {
        art: art("health"),
        title: `Does ${w.name} have any health conditions?`,
        subtitle: `Tap all that apply. Anyash will gently ask how ${w.shes} doing.`,
        body: (
          <MultiChips
            label="Health conditions"
            options={COMMON_CONDITIONS}
            value={form.conditions || []}
            onChange={(v) => set("conditions", v)}
            addPlaceholder="Add another, e.g. Back pain"
          />
        ),
      };

    case "medicines":
      return {
        art: art("pills"),
        title: `Any medicines ${w.she} ${w.she === "they" ? "take" : "takes"} every day?`,
        subtitle: "Name, dose and when, if you know. A rough idea is fine.",
        body: (
          <LineList
            items={form.medicines || []}
            onChange={(v) => set("medicines", v)}
            placeholder="e.g. Amlodipine 5 mg, after breakfast"
            addLabel="Add another medicine"
            itemLabel="Medicine"
          />
        ),
      };

    case "enjoys":
      return {
        art: art("chat"),
        title: `What does ${w.name} love talking about?`,
        subtitle: "Tap a few, or write your own. It makes the calls feel personal.",
        body: <EnjoysPicker value={form.enjoys || ""} onChange={(v) => set("enjoys", v)} w={w} />,
      };

    case "avoid":
      return {
        art: art("quiet"),
        title: "Anything Anyash should not bring up?",
        subtitle: "A sensitive topic, a recent loss, anything that upsets them.",
        body: (
          <>
            <label htmlFor="ob-avoid" className="sr-only">Topics to avoid</label>
            <TextAreaField
              id="ob-avoid"
              rows={3}
              value={form.avoid_topics}
              placeholder="e.g. A recent loss in the family, money matters"
              onChange={(e) => set("avoid_topics", e.target.value)}
            />
          </>
        ),
      };

    case "worry":
      return {
        art: art("lock"),
        title: `Is there anything you're worried about?`,
        subtitle: (
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-ob-mint px-2.5 py-0.5 text-[13px] font-semibold text-ob-brand">Private</span>
            Anyash will never say this to {w.her}. It helps us know what to look out for.
          </span>
        ),
        body: (
          <>
            <label htmlFor="ob-worry" className="sr-only">Your worry</label>
            <TextAreaField
              id="ob-worry"
              rows={3}
              value={form.child_worry}
              placeholder={`e.g. ${cap(w.she)} skips lunch when ${w.shes} alone`}
              onChange={(e) => set("child_worry", e.target.value)}
            />
          </>
        ),
      };
  }
}

/* ------------------------------------------------------------------ */
/* Pickers used above                                                  */
/* ------------------------------------------------------------------ */

function HonorificPicker({
  options,
  value,
  set,
  pick,
  error,
}: {
  options: string[];
  value: string;
  set: StepProps["set"];
  pick: StepProps["pick"];
  error?: string;
}) {
  const isCustom = value !== "" && !options.includes(value);
  const [custom, setCustom] = React.useState(isCustom);
  const showCustom = custom || isCustom;
  return (
    <>
      <div role="radiogroup" aria-label="What do you call them?" className="flex flex-wrap gap-2.5">
        {options.map((h) => (
          <Chip
            key={h}
            selected={!showCustom && value === h}
            onClick={() => {
              setCustom(false);
              pick({ honorific: h });
            }}
          >
            {h}
          </Chip>
        ))}
        <Chip
          selected={showCustom}
          onClick={() => {
            setCustom(true);
            if (!isCustom) set("honorific", "");
          }}
        >
          Something else
        </Chip>
      </div>
      {showCustom && (
        <div className="mt-3 animate-ob-in motion-reduce:animate-none">
          <label htmlFor="ob-honorific" className="sr-only">What do you call them?</label>
          <TextField
            id="ob-honorific"
            value={value}
            placeholder="e.g. Mausi, Bauji, Ammi Jaan"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            autoFocus={!isCustom}
            invalid={Boolean(error)}
            onChange={(e) => set("honorific", e.target.value)}
          />
        </div>
      )}
      <FieldError>{error}</FieldError>
    </>
  );
}

const ENJOY_TOPICS = ["Family", "Grandchildren", "Cooking", "Old songs", "Cricket", "Gardening", "Prayer & bhajans", "TV shows", "News", "Old friends"];

function EnjoysPicker({ value, onChange, w }: { value: string; onChange: (v: string) => void; w: Words }) {
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  const has = (t: string) => parts.some((p) => p.toLowerCase() === t.toLowerCase());
  const toggle = (t: string) => onChange((has(t) ? parts.filter((p) => p.toLowerCase() !== t.toLowerCase()) : [...parts, t]).join(", "));
  return (
    <>
      <div role="group" aria-label="Topics" className="flex flex-wrap gap-2">
        {ENJOY_TOPICS.map((t) => (
          <Chip key={t} role="checkbox" selected={has(t)} onClick={() => toggle(t)}>
            {t}
          </Chip>
        ))}
      </div>
      <label htmlFor="ob-enjoys" className="mt-4 block text-[14px] font-semibold text-ob-body">
        Anything else?
      </label>
      <TextAreaField
        id="ob-enjoys"
        rows={2}
        value={value}
        placeholder={`e.g. ${cap(w.hers)} garden, Kishore Kumar songs`}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2"
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Review                                                              */
/* ------------------------------------------------------------------ */

const phoneLabel = (p: string) => {
  const d = p.replace(/^\+91/, "");
  return p.startsWith("+91") && d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : p;
};

const LIVING_LABEL = (v: string, w: Words) => (v === "alone" ? "Alone" : v === "with_spouse" ? `With ${w.spouse}` : v === "with_family" ? "With family" : "");
const list = (v?: string[]) => (v || []).map((x) => x.trim()).filter(Boolean).join(", ");

export function reviewRows(form: OnboardingInput, w: Words): { step: StepKey; label: string; value: string }[] {
  return [
    { step: "child_name", label: "Your name", value: form.child_name },
    { step: "role", label: "Adding", value: w.short },
    { step: "parent_name", label: "Name", value: form.parent_name },
    { step: "honorific", label: `You call ${w.her}`, value: form.honorific },
    { step: "phone", label: "Phone", value: phoneLabel(form.phone_number) },
    { step: "language", label: "Language", value: form.language },
    { step: "call_time", label: "Best time", value: form.preferred_call_time ? clock12(form.preferred_call_time) : "" },
    { step: "living", label: "Lives", value: LIVING_LABEL(form.living_situation || "", w) },
    { step: "wake", label: "Wakes up", value: form.wake_time ? clock12(form.wake_time) : "" },
    { step: "sleep", label: "Sleeps", value: form.sleep_time ? clock12(form.sleep_time) : "" },
    { step: "conditions", label: "Health", value: list(form.conditions) },
    { step: "medicines", label: "Medicines", value: list(form.medicines) },
    { step: "enjoys", label: "Loves", value: form.enjoys || "" },
    { step: "avoid", label: "Avoid", value: form.avoid_topics || "" },
    { step: "worry", label: "Your worry", value: form.child_worry || "" },
  ];
}
