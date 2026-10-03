"use client";

import React, { useId, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { localIndianDigits as localDigits } from "@/lib/onboarding";

/**
 * Building blocks for the public onboarding page: large tap targets, 16px
 * text (no zoom on focus in iOS) and the light ob-* theme.
 */

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  optional,
  htmlFor,
  as = "div",
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  htmlFor?: string;
  /** "fieldset" for a group of chips, so the label is read as the group's name. */
  as?: "div" | "fieldset";
  children: React.ReactNode;
}) {
  const Wrapper = as;
  const Label = as === "fieldset" ? "legend" : "label";
  return (
    <Wrapper className="min-w-0" data-field-error={error ? "true" : undefined}>
      <Label {...(as === "div" ? { htmlFor } : {})} className="block text-[15px] font-semibold text-ob-ink leading-6">
        {label}
        {optional && <span className="ml-1.5 text-[13px] font-normal text-ob-faint">Optional</span>}
      </Label>
      {hint && <p className="mt-0.5 text-[13.5px] leading-5 text-ob-muted">{hint}</p>}
      <div className="mt-2.5">{children}</div>
      {error && (
        <p role="alert" className="mt-2 text-[13.5px] leading-5 text-ob-bad">
          {error}
        </p>
      )}
    </Wrapper>
  );
}

const INPUT =
  "w-full rounded-2xl bg-ob-card px-4 text-[16px] text-ob-ink placeholder:text-ob-faint ring-1 ring-ob-line shadow-[0_1px_2px_rgba(28,26,23,0.04)] outline-none transition-shadow focus:ring-2 focus:ring-ob-ink aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-ob-bad/70";

export function TextField({ invalid, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} className={`${INPUT} h-14 ${className}`} />;
}

export function TextAreaField({
  invalid,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      rows={3}
      {...props}
      aria-invalid={invalid || undefined}
      className={`${INPUT} py-3.5 leading-6 resize-none ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Phone                                                               */
/* ------------------------------------------------------------------ */

const formatLocal = (d: string) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);

/**
 * An Indian phone number with +91 fixed in front. The value is "+91" and the
 * digits. What was typed is shown as typed, and tidied when the field is left.
 */
export function PhoneField({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (phone: string) => void;
  invalid?: boolean;
}) {
  const digits = localDigits(value.replace(/^\+91/, ""));
  const [text, setText] = useState(() => formatLocal(digits));
  // Keep the shown text in step when the value changes from outside (restored answers).
  const [lastDigits, setLastDigits] = useState(digits);
  if (digits !== lastDigits) {
    setLastDigits(digits);
    if (localDigits(text) !== digits) setText(formatLocal(digits));
  }

  return (
    <div
      className={`flex items-center h-14 rounded-2xl bg-ob-card ring-1 ring-ob-line shadow-[0_1px_2px_rgba(28,26,23,0.04)] transition-shadow focus-within:ring-2 focus-within:ring-ob-ink ${
        invalid ? "!ring-2 !ring-ob-bad/70" : ""
      }`}
    >
      <span className="pl-4 pr-3 h-8 flex items-center gap-1.5 border-r border-ob-line text-[16px] text-ob-body select-none">
        <span aria-hidden>🇮🇳</span>+91
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="next"
        placeholder="98765 43210"
        aria-invalid={invalid || undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const d = localDigits(e.target.value);
          setLastDigits(d);
          onChange(d ? `+91${d}` : "");
        }}
        onBlur={() => setText(formatLocal(localDigits(text)))}
        className="flex-1 min-w-0 h-full bg-transparent px-3 text-[16px] tracking-wide text-ob-ink placeholder:text-ob-faint outline-none rounded-r-2xl"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chips and cards                                                     */
/* ------------------------------------------------------------------ */

export function Chip({
  selected,
  onClick,
  children,
  sub,
  role = "radio",
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  sub?: React.ReactNode;
  role?: "radio" | "checkbox";
  className?: string;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`relative min-h-12 px-4 py-2.5 rounded-2xl text-left ring-1 transition-[background-color,box-shadow,transform] active:scale-[0.98] ${
        selected
          ? "bg-ob-accent/60 ring-2 ring-ob-ink text-ob-ink"
          : "bg-ob-card ring-ob-line text-ob-body hover:ring-ob-faint"
      } ${className}`}
    >
      <span className="flex items-center gap-2">
        <span className="text-[15px] leading-5 font-medium">{children}</span>
        {selected && <Check className="w-4 h-4 shrink-0 text-ob-ink" strokeWidth={2.5} aria-hidden />}
      </span>
      {sub && <span className="block mt-0.5 text-[12.5px] leading-4 text-ob-muted">{sub}</span>}
    </button>
  );
}

/** One choice from a short list. Tapping the chosen one again clears it unless `required`. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  required,
  columns = "flex",
  label,
}: {
  options: { id: T; label: React.ReactNode; sub?: React.ReactNode }[];
  value: T | "";
  onChange: (v: T | "") => void;
  required?: boolean;
  columns?: "flex" | 2 | 3;
  label?: string;
}) {
  const layout =
    columns === 2 ? "grid grid-cols-2 gap-2" : columns === 3 ? "grid grid-cols-2 min-[420px]:grid-cols-3 gap-2" : "flex flex-wrap gap-2";
  return (
    <div role="radiogroup" aria-label={label} className={layout}>
      {options.map((o) => (
        <Chip
          key={o.id}
          selected={value === o.id}
          sub={o.sub}
          onClick={() => onChange(value === o.id && !required ? "" : o.id)}
        >
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left ring-1 transition-[background-color,box-shadow,transform] active:scale-[0.99] ${
        selected ? "bg-ob-accent/60 ring-2 ring-ob-ink" : "bg-ob-card ring-ob-line hover:ring-ob-faint"
      }`}
    >
      <span
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${selected ? "bg-ob-card text-ob-ink" : "bg-ob-soft text-ob-muted"}`}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-ob-ink leading-5">{title}</span>
        {sub && <span className="block mt-0.5 text-[13px] text-ob-muted leading-5">{sub}</span>}
      </span>
      <span
        aria-hidden
        className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center ring-1 ${
          selected ? "bg-ob-ink ring-ob-ink" : "ring-ob-faint"
        }`}
      >
        {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Times                                                               */
/* ------------------------------------------------------------------ */

export const clock12 = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m[2] === "00" ? `${h12} ${suffix}` : `${h12}:${m[2]} ${suffix}`;
};

/**
 * A time picked from a few common choices, or any time with "Other time".
 * Optional: tapping the chosen time again clears it.
 */
export function TimeChoice({
  id,
  label,
  presets,
  value,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  presets: { time: string; label?: string }[];
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const isPreset = presets.some((p) => p.time === value);
  const [custom, setCustom] = useState(Boolean(value) && !isPreset);
  const showCustom = custom || (Boolean(value) && !isPreset);

  return (
    <div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Chip
            key={p.time}
            selected={!showCustom && value === p.time}
            sub={p.label ? clock12(p.time) : undefined}
            onClick={() => {
              setCustom(false);
              onChange(value === p.time && !showCustom ? "" : p.time);
            }}
          >
            {p.label || clock12(p.time)}
          </Chip>
        ))}
        <Chip
          selected={showCustom}
          onClick={() => {
            if (showCustom) {
              setCustom(false);
              onChange("");
            } else {
              setCustom(true);
              if (isPreset) onChange("");
            }
          }}
        >
          Other time
        </Chip>
      </div>
      {showCustom && (
        <div className="mt-2.5 animate-ob-in motion-reduce:animate-none">
          <label htmlFor={id} className="sr-only">
            {label}
          </label>
          <TextField
            id={id}
            type="time"
            value={value}
            invalid={invalid}
            onChange={(e) => onChange(e.target.value)}
            className="max-w-[200px]"
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

/** Common choices as toggles, plus anything typed in. */
export function MultiChips({
  options,
  value,
  onChange,
  addPlaceholder,
  label,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  addPlaceholder: string;
  label: string;
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const has = (x: string) => value.some((v) => v.toLowerCase() === x.toLowerCase());
  const toggle = (x: string) => onChange(has(x) ? value.filter((v) => v.toLowerCase() !== x.toLowerCase()) : [...value, x]);
  const extras = value.filter((v) => v.trim() && !options.some((o) => o.toLowerCase() === v.toLowerCase()));
  const add = () => {
    const x = draft.replace(/\s+/g, " ").trim();
    if (x && !has(x)) onChange([...value, x]);
    setDraft("");
  };

  return (
    <div>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} role="checkbox" selected={has(o)} onClick={() => toggle(o)}>
            {o}
          </Chip>
        ))}
        {extras.map((x) => (
          <span
            key={x}
            className="inline-flex items-center gap-1 min-h-12 pl-4 pr-1.5 rounded-2xl bg-ob-accent/60 ring-2 ring-ob-ink text-[15px] font-medium text-ob-ink"
          >
            {x}
            <button
              type="button"
              aria-label={`Remove ${x}`}
              onClick={() => onChange(value.filter((v) => v !== x))}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-black/5"
            >
              <X className="w-4 h-4" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {addPlaceholder}
        </label>
        <TextField
          id={inputId}
          value={draft}
          placeholder={addPlaceholder}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // add, don't move to the next step
              add();
            }
          }}
          onBlur={add}
          className="!h-12"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Add"
          className="h-12 w-12 shrink-0 rounded-2xl bg-ob-ink text-white flex items-center justify-center disabled:opacity-30 transition-opacity"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/** A list of short text lines (one medicine per line). Always shows at least one line. */
export function LineList({
  items,
  onChange,
  placeholder,
  addLabel,
  itemLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
  itemLabel: string;
}) {
  const rows = items.length ? items : [""];
  return (
    <div className="space-y-2">
      {rows.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <TextField
            value={item}
            aria-label={`${itemLabel} ${i + 1}`}
            placeholder={i === 0 ? placeholder : ""}
            autoComplete="off"
            enterKeyHint="next"
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))}
            className="!h-12"
          />
          {(rows.length > 1 || item) && (
            <button
              type="button"
              aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [])}
              className="w-12 h-12 shrink-0 rounded-2xl text-ob-muted hover:text-ob-ink hover:bg-ob-soft flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, ""])}
        className="inline-flex items-center gap-2 h-11 px-1 text-[15px] font-medium text-ob-ink"
      >
        <span className="w-7 h-7 rounded-full bg-ob-soft flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </span>
        {addLabel}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function PrimaryButton({
  className = "",
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={`w-full h-14 rounded-2xl bg-ob-ink text-white text-[16px] font-semibold flex items-center justify-center gap-2 shadow-[0_6px_20px_-6px_rgba(28,26,23,0.45)] transition-[transform,opacity] active:scale-[0.99] disabled:opacity-60 ${className}`}
    >
      {loading && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-ob-ink ${className}`}>
      <span className="w-7 h-7 rounded-lg bg-ob-ink flex items-center justify-center" aria-hidden>
        <span className="w-2.5 h-2.5 rounded-full bg-ob-accent" />
      </span>
      <span className="text-[16px] font-semibold tracking-tight">Anyash</span>
    </span>
  );
}
