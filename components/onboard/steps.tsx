"use client";

import React from "react";
import { Home, Lock, User, Users } from "lucide-react";
import { LANGUAGES, RELATIONSHIPS } from "@/lib/languages";
import {
  COMMON_CONDITIONS,
  HONORIFICS,
  LIVING_SITUATIONS,
  LivingSituation,
  OnboardingErrors,
  OnboardingInput,
} from "@/lib/onboarding";
import {
  ChipGroup,
  ChoiceCard,
  clock12,
  Field,
  LineList,
  MultiChips,
  PhoneField,
  TextAreaField,
  TextField,
  TimeChoice,
  Chip,
} from "./ui";

/* ------------------------------------------------------------------ */
/* Step definitions                                                    */
/* ------------------------------------------------------------------ */

export type StepId = "you" | "parent" | "reach" | "day" | "health" | "notes";

export interface StepDef {
  id: StepId;
  /** Short name used on the review screen. */
  name: string;
  fields: (keyof OnboardingInput)[];
  optional?: boolean;
}

export const STEPS: StepDef[] = [
  { id: "you", name: "About you", fields: ["child_name", "relationship"] },
  { id: "parent", name: "Your parent", fields: ["parent_name", "honorific"] },
  { id: "reach", name: "Phone and language", fields: ["phone_number", "preferred_call_time", "language"] },
  { id: "day", name: "Their day", fields: ["living_situation", "household_help", "wake_time", "sleep_time"], optional: true },
  { id: "health", name: "Health", fields: ["conditions", "medicines"], optional: true },
  { id: "notes", name: "Good to know", fields: ["enjoys", "avoid_topics", "child_worry"], optional: true },
];

/** Whether the person typed or picked anything on this step. */
export function stepHasAnswers(step: StepDef, form: OnboardingInput): boolean {
  return step.fields.some((f) => {
    const v = form[f];
    return Array.isArray(v) ? v.some((x) => typeof x === "string" && x.trim()) : typeof v === "string" && v.trim() !== "";
  });
}

export function stepErrors(step: StepDef, errors: OnboardingErrors): OnboardingErrors {
  const out: OnboardingErrors = {};
  for (const f of step.fields) if (errors[f]) out[f] = errors[f];
  return out;
}

/** How the form refers to the parent once it knows: "Mummy Ji", else "your parent". */
export const whoOf = (form: OnboardingInput) => form.honorific.trim() || "your parent";
const WhoCap = (form: OnboardingInput) => {
  const who = whoOf(form);
  return who.charAt(0).toUpperCase() + who.slice(1);
};

/* ------------------------------------------------------------------ */
/* Step layout                                                         */
/* ------------------------------------------------------------------ */

export function StepHeading({
  title,
  intro,
  headingRef,
}: {
  title: React.ReactNode;
  intro?: React.ReactNode;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div>
      <h1 ref={headingRef} tabIndex={-1} className="text-[26px] leading-[32px] font-semibold tracking-tight text-ob-ink outline-none">
        {title}
      </h1>
      {intro && <p className="mt-2 text-[15px] leading-6 text-ob-muted">{intro}</p>}
    </div>
  );
}

interface StepProps {
  form: OnboardingInput;
  set: <K extends keyof OnboardingInput>(key: K, v: OnboardingInput[K]) => void;
  errors: OnboardingErrors;
  headingRef: React.Ref<HTMLHeadingElement>;
}

/* ------------------------------------------------------------------ */
/* 1. About you                                                        */
/* ------------------------------------------------------------------ */

export function YouStep({ form, set, errors, headingRef }: StepProps) {
  return (
    <div className="space-y-8">
      <StepHeading headingRef={headingRef} title="First, a little about you" intro="So we know who added your parent." />
      <Field label="Your name" htmlFor="ob-child" error={errors.child_name}>
        <TextField
          id="ob-child"
          name="child_name"
          value={form.child_name}
          placeholder="e.g. Priya Sharma"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          invalid={Boolean(errors.child_name)}
          onChange={(e) => set("child_name", e.target.value)}
        />
      </Field>
      <Field as="fieldset" label="You are their…" optional>
        <ChipGroup
          label="You are their"
          options={RELATIONSHIPS.map((r) => ({ id: r, label: r }))}
          value={form.relationship || ""}
          onChange={(v) => set("relationship", v)}
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Your parent                                                      */
/* ------------------------------------------------------------------ */

export function ParentStep({ form, set, errors, headingRef }: StepProps) {
  const isCustom = form.honorific !== "" && !HONORIFICS.includes(form.honorific);
  const [custom, setCustom] = React.useState(isCustom);
  const showCustom = custom || isCustom;

  return (
    <div className="space-y-8">
      <StepHeading headingRef={headingRef} title="Who should Anyash call?" intro="Tell us about the parent you'd like Anyash to call." />
      <Field label="Their full name" htmlFor="ob-parent" hint="As they would write it." error={errors.parent_name}>
        <TextField
          id="ob-parent"
          name="parent_name"
          value={form.parent_name}
          placeholder="e.g. Sunita Sharma"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          invalid={Boolean(errors.parent_name)}
          onChange={(e) => set("parent_name", e.target.value)}
        />
      </Field>
      <Field
        as="fieldset"
        label="What should Anyash call them?"
        hint={
          <>
            Anyash greets them with this, like{" "}
            <span className="text-ob-ink">“Namaste {form.honorific.trim() || "Mummy Ji"}!”</span>
          </>
        }
        error={errors.honorific}
      >
        <div role="radiogroup" aria-label="What should Anyash call them?" className="flex flex-wrap gap-2">
          {HONORIFICS.map((h) => (
            <Chip
              key={h}
              selected={!showCustom && form.honorific === h}
              onClick={() => {
                setCustom(false);
                set("honorific", h);
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
          <div className="mt-2.5 animate-ob-in motion-reduce:animate-none">
            <label htmlFor="ob-honorific" className="sr-only">
              What should Anyash call them?
            </label>
            <TextField
              id="ob-honorific"
              value={form.honorific}
              placeholder="e.g. Aai, Baba, Mausi Ji"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              autoFocus={!isCustom}
              invalid={Boolean(errors.honorific)}
              onChange={(e) => set("honorific", e.target.value)}
            />
          </div>
        )}
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Phone and language                                               */
/* ------------------------------------------------------------------ */

const CALL_TIMES = [
  { time: "10:00", label: "Morning" },
  { time: "13:00", label: "Afternoon" },
  { time: "18:00", label: "Evening" },
  { time: "20:00", label: "Night" },
];

export function ReachStep({ form, set, errors, headingRef }: StepProps) {
  return (
    <div className="space-y-8">
      <StepHeading headingRef={headingRef} title={`How to reach ${whoOf(form)}`} intro="Anyash will call this number." />
      <Field label="Their phone number" htmlFor="ob-phone" hint="A mobile or a landline with its area code." error={errors.phone_number}>
        <PhoneField id="ob-phone" value={form.phone_number} invalid={Boolean(errors.phone_number)} onChange={(v) => set("phone_number", v)} />
      </Field>
      <Field as="fieldset" label="Best time to call" optional hint="When are they usually free and relaxed?" error={errors.preferred_call_time}>
        <TimeChoice
          id="ob-calltime"
          label="Best time to call"
          presets={CALL_TIMES}
          value={form.preferred_call_time || ""}
          invalid={Boolean(errors.preferred_call_time)}
          onChange={(v) => set("preferred_call_time", v)}
        />
      </Field>
      <Field as="fieldset" label="Language they speak" hint="Anyash will talk to them in this language." error={errors.language}>
        <ChipGroup
          label="Language they speak"
          columns={3}
          required
          options={LANGUAGES.map((l) => ({
            id: l.id,
            label: l.label,
            sub: l.nativeName !== l.label ? l.nativeName : undefined,
          }))}
          value={form.language as any}
          onChange={(v) => set("language", v)}
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Their day                                                        */
/* ------------------------------------------------------------------ */

const LIVING_ICONS: Record<LivingSituation, React.ReactNode> = {
  alone: <User className="w-5 h-5" />,
  with_spouse: <Users className="w-5 h-5" />,
  with_family: <Home className="w-5 h-5" />,
};

const LIVING_SUBS: Record<LivingSituation, string> = {
  alone: "They live on their own",
  with_spouse: "Just the two of them",
  with_family: "With children or other family",
};

export function DayStep({ form, set, errors, headingRef }: StepProps) {
  return (
    <div className="space-y-8">
      <StepHeading
        headingRef={headingRef}
        title={`${WhoCap(form)}'s day`}
        intro="This helps Anyash ask the right things at the right time, like “Have you had lunch?”"
      />
      <Field as="fieldset" label="Who do they live with?" optional error={errors.living_situation}>
        <div role="radiogroup" aria-label="Who do they live with?" className="space-y-2">
          {LIVING_SITUATIONS.map((opt) => (
            <ChoiceCard
              key={opt.id}
              selected={form.living_situation === opt.id}
              onClick={() => set("living_situation", form.living_situation === opt.id ? "" : opt.id)}
              icon={LIVING_ICONS[opt.id]}
              title={opt.label}
              sub={LIVING_SUBS[opt.id]}
            />
          ))}
        </div>
      </Field>
      <Field label="Help at home" htmlFor="ob-help" optional hint="Who cooks? Does anyone come to help?">
        <TextAreaField
          id="ob-help"
          rows={2}
          value={form.household_help}
          placeholder="e.g. She cooks herself. A helper comes in the morning to clean."
          onChange={(e) => set("household_help", e.target.value)}
        />
      </Field>
      <Field as="fieldset" label="They usually wake up at" optional error={errors.wake_time}>
        <TimeChoice
          id="ob-wake"
          label="They usually wake up at"
          presets={[{ time: "05:00" }, { time: "06:00" }, { time: "07:00" }, { time: "08:00" }]}
          value={form.wake_time || ""}
          invalid={Boolean(errors.wake_time)}
          onChange={(v) => set("wake_time", v)}
        />
      </Field>
      <Field as="fieldset" label="They usually go to sleep at" optional error={errors.sleep_time}>
        <TimeChoice
          id="ob-sleep"
          label="They usually go to sleep at"
          presets={[{ time: "21:00" }, { time: "22:00" }, { time: "23:00" }]}
          value={form.sleep_time || ""}
          invalid={Boolean(errors.sleep_time)}
          onChange={(v) => set("sleep_time", v)}
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Health                                                           */
/* ------------------------------------------------------------------ */

export function HealthStep({ form, set, headingRef }: StepProps) {
  return (
    <div className="space-y-8">
      <StepHeading
        headingRef={headingRef}
        title="Any health conditions?"
        intro="So Anyash can gently ask how they're doing, like “Did you take your BP tablet today?”"
      />
      <Field as="fieldset" label="Conditions" optional hint="Tap all that apply.">
        <MultiChips
          label="Conditions"
          options={COMMON_CONDITIONS}
          value={form.conditions || []}
          onChange={(v) => set("conditions", v)}
          addPlaceholder="Add another, e.g. Back pain"
        />
      </Field>
      <Field as="fieldset" label="Daily medicines" optional hint="Name, dose and when they take it, if you know.">
        <LineList
          items={form.medicines || []}
          onChange={(v) => set("medicines", v)}
          placeholder="e.g. Amlodipine 5 mg, after breakfast"
          addLabel="Add another medicine"
          itemLabel="Medicine"
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Good to know                                                     */
/* ------------------------------------------------------------------ */

export function NotesStep({ form, set, headingRef }: StepProps) {
  return (
    <div className="space-y-8">
      <StepHeading
        headingRef={headingRef}
        title="A few things to know"
        intro={`This makes the calls feel personal, like talking to someone who knows ${whoOf(form)}.`}
      />
      <Field label="What do they enjoy talking about?" htmlFor="ob-enjoys" optional>
        <TextAreaField
          id="ob-enjoys"
          rows={2}
          value={form.enjoys}
          placeholder="e.g. Old Hindi songs, her garden, cricket, the grandchildren"
          onChange={(e) => set("enjoys", e.target.value)}
        />
      </Field>
      <Field label="Anything Anyash should not bring up?" htmlFor="ob-avoid" optional>
        <TextAreaField
          id="ob-avoid"
          rows={2}
          value={form.avoid_topics}
          placeholder="e.g. A recent loss in the family, money matters"
          onChange={(e) => set("avoid_topics", e.target.value)}
        />
      </Field>
      <div className="rounded-3xl bg-ob-soft p-4 ring-1 ring-ob-line">
        <Field
          label="What worries you most about them?"
          htmlFor="ob-worry"
          optional
          hint={
            <span className="inline-flex items-start gap-1.5">
              <Lock className="w-3.5 h-3.5 mt-[3px] shrink-0" aria-hidden />
              Private. Anyash never says this to them. It helps us know what to look out for.
            </span>
          }
        >
          <TextAreaField
            id="ob-worry"
            rows={2}
            value={form.child_worry}
            placeholder="e.g. She skips meals when she's alone"
            onChange={(e) => set("child_worry", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Review                                                              */
/* ------------------------------------------------------------------ */

const living = (v?: string) => LIVING_SITUATIONS.find((l) => l.id === v)?.label || "";
const list = (v?: string[]) => (v || []).map((x) => x.trim()).filter(Boolean).join(", ");
const phoneLabel = (p: string) => {
  const d = p.replace(/^\+91/, "");
  return p.startsWith("+91") && d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : p;
};

function reviewRows(id: StepId, form: OnboardingInput): [string, string][] {
  switch (id) {
    case "you":
      return [
        ["Your name", form.child_name],
        ["You are their", form.relationship || ""],
      ];
    case "parent":
      return [
        ["Name", form.parent_name],
        ["Anyash calls them", form.honorific],
      ];
    case "reach":
      return [
        ["Phone", phoneLabel(form.phone_number)],
        ["Best time to call", form.preferred_call_time ? clock12(form.preferred_call_time) : ""],
        ["Language", form.language],
      ];
    case "day":
      return [
        ["Lives", living(form.living_situation)],
        ["Help at home", form.household_help || ""],
        ["Wakes up", form.wake_time ? clock12(form.wake_time) : ""],
        ["Goes to sleep", form.sleep_time ? clock12(form.sleep_time) : ""],
      ];
    case "health":
      return [
        ["Conditions", list(form.conditions)],
        ["Medicines", list(form.medicines)],
      ];
    case "notes":
      return [
        ["Enjoys", form.enjoys || ""],
        ["Avoid", form.avoid_topics || ""],
        ["Your worry (private)", form.child_worry || ""],
      ];
  }
}

export function ReviewStep({
  form,
  errors,
  headingRef,
  onEdit,
}: {
  form: OnboardingInput;
  errors: OnboardingErrors;
  headingRef: React.Ref<HTMLHeadingElement>;
  onEdit: (stepIndex: number) => void;
}) {
  return (
    <div className="space-y-6">
      <StepHeading headingRef={headingRef} title="Check everything" intro="Tap Edit to change anything. Then save." />
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const rows = reviewRows(step.id, form);
          const filled = rows.filter(([, v]) => v.trim());
          const hasError = step.fields.some((f) => errors[f]);
          return (
            <section
              key={step.id}
              aria-label={step.name}
              className={`rounded-3xl bg-ob-card p-4 ring-1 shadow-[0_1px_2px_rgba(28,26,23,0.04)] ${hasError ? "ring-2 ring-ob-bad/60" : "ring-ob-line"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ob-muted">{step.name}</h2>
                <button
                  type="button"
                  onClick={() => onEdit(i)}
                  className="h-9 -my-1.5 -mr-2 px-3 rounded-full text-[14px] font-medium text-ob-ink hover:bg-ob-soft"
                  aria-label={`Edit ${step.name}`}
                >
                  Edit
                </button>
              </div>
              {filled.length ? (
                <dl className="mt-2 space-y-2">
                  {filled.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 text-[15px] leading-6">
                      <dt className="text-ob-muted">{k}</dt>
                      <dd className="text-ob-ink break-words min-w-0">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-[15px] text-ob-faint">Skipped</p>
              )}
              {hasError && (
                <p className="mt-2 text-[13.5px] leading-5 text-ob-bad">
                  {step.fields.map((f) => errors[f]).filter(Boolean)[0]}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
