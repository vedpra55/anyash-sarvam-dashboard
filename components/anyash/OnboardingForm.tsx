"use client";

import React from "react";
import { X, Plus } from "lucide-react";
import { LANGUAGES, RELATIONSHIPS } from "@/lib/languages";
import { HONORIFICS, LIVING_SITUATIONS, PARENT_ROLES, ParentRole, QUESTIONS, OnboardingInput } from "@/lib/onboarding";
import { FieldLabel, TextInput, SelectInput, TextArea } from "./primitives";

export const EMPTY_ONBOARDING: OnboardingInput = {
  parent_name: "",
  honorific: "",
  language: "Hindi",
  phone_number: "+91 ",
  child_name: "",
  relationship: "Daughter",
  living_situation: "",
  household_help: "",
  wake_time: "",
  sleep_time: "",
  preferred_call_time: "",
  conditions: [],
  medicines: [],
  enjoys: "",
  avoid_topics: "",
  child_worry: "",
};

/** An editable list of short text items. */
export function ListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <TextInput
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            type="button"
            aria-label="Remove"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="w-9 h-9 shrink-0 rounded-full text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.05] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-1.5 h-8 text-[13px] text-zinc-400 hover:text-white"
      >
        <Plus className="w-3.5 h-3.5" />
        {addLabel}
      </button>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-[13px] font-medium text-zinc-500">{title}</h3>
        {note && <p className="text-[12.5px] text-zinc-600 mt-0.5 leading-5">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * The child's onboarding questions. Used by the Add / Edit parent pop-up and
 * by the public /onboard/[token] page.
 */
export function OnboardingForm({
  value,
  onChange,
  idPrefix = "ob",
  extra,
}: {
  value: OnboardingInput;
  onChange: (next: OnboardingInput) => void;
  idPrefix?: string;
  /** Rendered after the Day section (e.g. the dashboard's routine editor). */
  extra?: React.ReactNode;
}) {
  const set = <K extends keyof OnboardingInput>(key: K, v: OnboardingInput[K]) => onChange({ ...value, [key]: v });
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-8">
      <Section title="Basics">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldLabel label={QUESTIONS.parent_name} htmlFor={id("name")}>
            <TextInput id={id("name")} value={value.parent_name} autoComplete="off" placeholder="Sunita Sharma"
              onChange={(e) => set("parent_name", e.target.value)} />
          </FieldLabel>
          <FieldLabel label="Mom or Dad" htmlFor={id("role")}>
            <SelectInput id={id("role")} value={value.parent_role || ""} onChange={(e) => set("parent_role", e.target.value as ParentRole | "")}>
              <option value="">Not set</option>
              {PARENT_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </SelectInput>
          </FieldLabel>
          <FieldLabel label={QUESTIONS.honorific} htmlFor={id("honorific")}>
            <TextInput id={id("honorific")} value={value.honorific} list={id("honorifics")} placeholder="Mummy Ji"
              onChange={(e) => set("honorific", e.target.value)} />
            <datalist id={id("honorifics")}>
              {HONORIFICS.map((h) => <option key={h} value={h} />)}
            </datalist>
          </FieldLabel>
          <FieldLabel label={QUESTIONS.language} htmlFor={id("lang")}>
            <SelectInput id={id("lang")} value={value.language} onChange={(e) => set("language", e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </SelectInput>
          </FieldLabel>
          <FieldLabel label={QUESTIONS.phone_number} htmlFor={id("phone")}>
            <TextInput id={id("phone")} value={value.phone_number} inputMode="tel" autoComplete="off" placeholder="+91 98765 43210"
              onChange={(e) => set("phone_number", e.target.value)} />
          </FieldLabel>
          <FieldLabel label={QUESTIONS.child_name} htmlFor={id("child")}>
            <TextInput id={id("child")} value={value.child_name} placeholder="Priya"
              onChange={(e) => set("child_name", e.target.value)} />
          </FieldLabel>
          <FieldLabel label={QUESTIONS.relationship} htmlFor={id("rel")}>
            <SelectInput id={id("rel")} value={value.relationship || ""} onChange={(e) => set("relationship", e.target.value)}>
              {Array.from(new Set([...RELATIONSHIPS, value.relationship || ""]))
                .filter(Boolean)
                .map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
            </SelectInput>
          </FieldLabel>
        </div>
      </Section>

      <Section title="Home">
        <fieldset>
          <legend className="block text-[13px] text-zinc-300 mb-1.5">{QUESTIONS.living_situation}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {LIVING_SITUATIONS.map((opt) => {
              const selected = value.living_situation === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => set("living_situation", selected ? "" : opt.id)}
                  className={`min-h-10 px-3 py-2 rounded-lg text-left text-[13.5px] ring-1 transition-colors ${
                    selected ? "bg-ay-accent/15 ring-ay-accent/60 text-white" : "bg-white/[0.04] ring-white/[0.08] text-zinc-300 hover:bg-white/[0.06]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <FieldLabel label={QUESTIONS.household_help} htmlFor={id("help")}>
          <TextArea id={id("help")} rows={2} value={value.household_help} placeholder="She cooks herself. A helper comes in the morning to clean."
            onChange={(e) => set("household_help", e.target.value)} />
        </FieldLabel>
      </Section>

      <Section title="Day">
        <div>
          <p className="text-[13px] text-zinc-300 mb-1.5">{QUESTIONS.wake_sleep}</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Wakes up" htmlFor={id("wake")}>
              <TextInput id={id("wake")} type="time" value={value.wake_time} onChange={(e) => set("wake_time", e.target.value)} />
            </FieldLabel>
            <FieldLabel label="Goes to sleep" htmlFor={id("sleep")}>
              <TextInput id={id("sleep")} type="time" value={value.sleep_time} onChange={(e) => set("sleep_time", e.target.value)} />
            </FieldLabel>
          </div>
        </div>
        <FieldLabel
          label={QUESTIONS.preferred_call_time}
          htmlFor={id("calltime")}
          hint="Anyash usually calls around this time."
        >
          <TextInput id={id("calltime")} type="time" value={value.preferred_call_time} onChange={(e) => set("preferred_call_time", e.target.value)} />
        </FieldLabel>
        {extra}
      </Section>

      <Section title="Health">
        <p className="text-[13px] text-zinc-300 -mb-2">{QUESTIONS.health}</p>
        <FieldLabel label="Conditions">
          <ListEditor items={value.conditions || []} onChange={(v) => set("conditions", v)} placeholder="High BP" addLabel="Add condition" />
        </FieldLabel>
        <FieldLabel label="Daily medicines">
          <ListEditor items={value.medicines || []} onChange={(v) => set("medicines", v)} placeholder="Amlodipine 5 mg, after breakfast" addLabel="Add medicine" />
        </FieldLabel>
      </Section>

      <Section title="Life">
        <FieldLabel label={QUESTIONS.enjoys} htmlFor={id("enjoys")}>
          <TextArea id={id("enjoys")} rows={2} value={value.enjoys} placeholder="Old songs, her garden, the grandchildren"
            onChange={(e) => set("enjoys", e.target.value)} />
        </FieldLabel>
      </Section>

      <Section title="Care">
        <FieldLabel label={QUESTIONS.avoid_topics} htmlFor={id("avoid")} hint="E.g. a recent loss, trouble hearing, a sensitive topic.">
          <TextArea id={id("avoid")} rows={2} value={value.avoid_topics}
            onChange={(e) => set("avoid_topics", e.target.value)} />
        </FieldLabel>
      </Section>

      <Section title="Your worry" note="Private. Only the Anyash team sees this. It is never said to the parent.">
        <FieldLabel label={QUESTIONS.child_worry} htmlFor={id("worry")}>
          <TextArea id={id("worry")} rows={2} value={value.child_worry}
            onChange={(e) => set("child_worry", e.target.value)} />
        </FieldLabel>
      </Section>
    </div>
  );
}
