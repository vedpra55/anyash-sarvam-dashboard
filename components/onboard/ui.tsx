"use client";

import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Clock3, Plus, X } from "lucide-react";
import { localIndianDigits } from "@/lib/onboarding";

/**
 * Building blocks for the public onboarding page, in the anyash.vercel.app
 * style: white cards on #FAFAFA, deep green selection, round buttons, 16px
 * text (no zoom on focus in iOS) and big tap targets.
 */

/* ------------------------------------------------------------------ */
/* Brand                                                               */
/* ------------------------------------------------------------------ */

export function Logo({ className = "h-7" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/onboard/logo.png" alt="Anyash" width={480} height={160} className={`w-auto object-contain ${className}`} />;
}

/* ------------------------------------------------------------------ */
/* Text inputs                                                         */
/* ------------------------------------------------------------------ */

const INPUT =
  "w-full rounded-2xl border border-ob-line bg-ob-card px-5 text-[17px] text-ob-ink placeholder:text-ob-faint/80 shadow-[0_1px_2px_rgba(32,39,36,0.04)] outline-none transition-[border-color,box-shadow] focus:border-ob-brand focus:ring-4 focus:ring-ob-brand/10 aria-[invalid=true]:border-ob-bad aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-ob-bad/10";

export function TextField({ invalid, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} className={`${INPUT} h-[60px] ${className}`} />;
}

export function TextAreaField({
  invalid,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea rows={4} {...props} aria-invalid={invalid || undefined} className={`${INPUT} py-4 leading-7 resize-none ${className}`} />;
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-3 flex items-start gap-2 text-[14px] leading-5 text-ob-bad animate-ob-fade">
      <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-ob-bad shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Phone                                                               */
/* ------------------------------------------------------------------ */

const formatLocal = (d: string) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);

/**
 * An Indian phone number with +91 fixed in front. The value is "+91" and the
 * digits. What was typed is shown as typed, and tidied when the field is left,
 * so the cursor never jumps.
 */
export function PhoneField({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (phone: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const digits = localIndianDigits(value.replace(/^\+91/, ""));
  const [text, setText] = useState(() => formatLocal(digits));
  const [lastDigits, setLastDigits] = useState(digits);
  if (digits !== lastDigits) {
    setLastDigits(digits);
    if (localIndianDigits(text) !== digits) setText(formatLocal(digits));
  }

  return (
    <div
      className={`flex items-center h-[60px] rounded-2xl border bg-ob-card shadow-[0_1px_2px_rgba(32,39,36,0.04)] transition-[border-color,box-shadow] focus-within:border-ob-brand focus-within:ring-4 focus-within:ring-ob-brand/10 ${
        invalid ? "border-ob-bad ring-4 ring-ob-bad/10" : "border-ob-line"
      }`}
    >
      <span className="pl-5 pr-3.5 h-8 flex items-center gap-2 border-r border-ob-line text-[17px] font-medium text-ob-body select-none">
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
        aria-describedby={describedBy}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const d = localIndianDigits(e.target.value);
          setLastDigits(d);
          onChange(d ? `+91${d}` : "");
        }}
        onBlur={() => setText(formatLocal(localIndianDigits(text)))}
        className="flex-1 min-w-0 h-full bg-transparent px-4 text-[17px] tracking-wide text-ob-ink placeholder:text-ob-faint/80 outline-none rounded-r-2xl"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Choices                                                             */
/* ------------------------------------------------------------------ */

/** A large tappable card, like the options on anyash.vercel.app/research. */
export function OptionCard({
  selected,
  onClick,
  title,
  hint,
  leading,
  role = "radio",
}: {
  selected: boolean;
  onClick: () => void;
  title: React.ReactNode;
  hint?: React.ReactNode;
  leading?: React.ReactNode;
  role?: "radio" | "checkbox";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`group w-full flex items-center gap-3.5 p-4 rounded-2xl border text-left transition-[border-color,background-color,box-shadow,transform] active:scale-[0.99] ${
        selected
          ? "border-ob-brand bg-ob-brand/[0.05] ring-1 ring-ob-brand animate-ob-tap motion-reduce:animate-none"
          : "border-ob-line bg-ob-card hover:border-ob-brand/40"
      }`}
    >
      {leading}
      <span className="flex-1 min-w-0">
        <span className={`block text-[17px] leading-6 ${selected ? "font-semibold text-ob-brand" : "font-medium text-ob-ink"}`}>{title}</span>
        {hint && <span className="block mt-0.5 text-[14px] leading-5 text-ob-muted">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
          selected ? "border-ob-brand bg-ob-brand" : "border-ob-line group-hover:border-ob-brand/60"
        }`}
      >
        {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

/** A compact pill for short answers. */
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
      className={`min-h-[52px] px-4 py-2.5 rounded-2xl border text-left transition-[border-color,background-color,box-shadow,transform] active:scale-[0.97] ${
        selected
          ? "border-ob-brand bg-ob-brand text-white shadow-[0_6px_16px_-8px_rgba(23,74,64,0.7)] animate-ob-tap motion-reduce:animate-none"
          : "border-ob-line bg-ob-card text-ob-ink hover:border-ob-brand/40"
      } ${className}`}
    >
      <span className="flex items-center gap-1.5">
        <span className="text-[16px] leading-5 font-semibold">{children}</span>
        {selected && <Check className="w-4 h-4 shrink-0" strokeWidth={3} aria-hidden />}
      </span>
      {sub && <span className={`block mt-0.5 text-[13px] leading-4 ${selected ? "text-white/80" : "text-ob-muted"}`}>{sub}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

export const clock12 = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m[2] === "00" ? `${h12} ${suffix}` : `${h12}:${m[2]} ${suffix}`;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A few likely times as one-tap chips, and "Pick another time" for anything
 * else, chosen in a bottom sheet (hour, minutes, AM/PM). No native picker.
 */
export function TimeChoice({
  label,
  presets,
  value,
  onPick,
}: {
  label: string;
  presets: { time: string; label?: string }[];
  value: string;
  /** Called with the chosen "HH:MM", or "" when cleared. */
  onPick: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isPreset = presets.some((p) => p.time === value);
  const custom = Boolean(value) && !isPreset;

  return (
    <div>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2.5">
        {presets.map((p) => (
          <Chip key={p.time} selected={value === p.time} sub={p.label ? clock12(p.time) : undefined} onClick={() => onPick(value === p.time ? "" : p.time)} className="!min-h-[64px]">
            {p.label || clock12(p.time)}
          </Chip>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-2.5 w-full min-h-[56px] px-4 rounded-2xl border flex items-center gap-3 text-left transition-colors ${
          custom ? "border-ob-brand bg-ob-brand/[0.05] ring-1 ring-ob-brand" : "border-dashed border-ob-faint/60 bg-transparent hover:border-ob-brand/50"
        }`}
      >
        <Clock3 className={`w-5 h-5 shrink-0 ${custom ? "text-ob-brand" : "text-ob-muted"}`} aria-hidden />
        <span className={`flex-1 text-[16px] ${custom ? "font-semibold text-ob-brand" : "font-medium text-ob-body"}`}>
          {custom ? clock12(value) : "Pick another time"}
        </span>
        {custom && <span className="text-[14px] font-medium text-ob-brand">Change</span>}
      </button>
      {open && (
        <TimeSheet
          title={label}
          initial={value || presets[0]?.time || "09:00"}
          onClose={() => setOpen(false)}
          onDone={(v) => {
            setOpen(false);
            onPick(v);
          }}
        />
      )}
    </div>
  );
}

function TimeSheet({
  title,
  initial,
  onClose,
  onDone,
}: {
  title: string;
  initial: string;
  onClose: () => void;
  onDone: (v: string) => void;
}) {
  const [h0, m0] = initial.split(":").map(Number);
  const [hour12, setHour12] = useState((h0 % 12) || 12);
  const [minute, setMinute] = useState([0, 15, 30, 45].includes(m0) ? m0 : 0);
  const [pm, setPm] = useState(h0 >= 12);
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const hour24 = (hour12 % 12) + (pm ? 12 : 0);
  const value = `${pad(hour24)}:${pad(minute)}`;

  // Rendered at the page root: the sliding screen's transform would otherwise trap a fixed sheet inside it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center font-jakarta">
      <div className="absolute inset-0 bg-ob-ink/40 animate-ob-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[520px] rounded-t-[28px] bg-ob-card px-5 pt-3 shadow-[0_-12px_40px_-12px_rgba(32,39,36,0.35)] animate-ob-sheet motion-reduce:animate-none"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
      >
        <div className="mx-auto w-10 h-1.5 rounded-full bg-ob-line" aria-hidden />
        <div className="mt-4 flex items-center justify-between">
          <h2 id={titleId} className="text-[15px] font-semibold text-ob-muted">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-ob-muted hover:bg-ob-soft">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p key={value} className="mt-1 text-center text-[44px] leading-none font-extrabold tracking-tight text-ob-brand tabular-nums animate-ob-fade" aria-live="polite">
          {clock12(value).replace(" ", " ")}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-1 p-1 rounded-2xl bg-ob-soft" role="radiogroup" aria-label="AM or PM">
          {[false, true].map((isPm) => (
            <button
              key={String(isPm)}
              type="button"
              role="radio"
              aria-checked={pm === isPm}
              onClick={() => setPm(isPm)}
              className={`h-14 rounded-xl flex flex-col items-center justify-center transition-colors ${pm === isPm ? "bg-ob-card text-ob-brand shadow-sm" : "text-ob-muted"}`}
            >
              <span className="text-[16px] font-bold leading-5">{isPm ? "PM" : "AM"}</span>
              <span className="text-[12px] font-medium leading-4 opacity-80">{isPm ? "Afternoon & night" : "Morning"}</span>
            </button>
          ))}
        </div>

        <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-ob-muted">Hour</p>
        <div className="mt-2 grid grid-cols-6 gap-2" role="radiogroup" aria-label="Hour">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={hour12 === h}
              onClick={() => setHour12(h)}
              className={`h-12 rounded-xl text-[17px] font-semibold tabular-nums transition-colors ${
                hour12 === h ? "bg-ob-brand text-white" : "bg-ob-soft text-ob-ink hover:bg-ob-mint"
              }`}
            >
              {h}
            </button>
          ))}
        </div>

        <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-ob-muted">Minutes</p>
        <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Minutes">
          {[0, 15, 30, 45].map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={minute === m}
              onClick={() => setMinute(m)}
              className={`h-12 rounded-xl text-[17px] font-semibold tabular-nums transition-colors ${
                minute === m ? "bg-ob-brand text-white" : "bg-ob-soft text-ob-ink hover:bg-ob-mint"
              }`}
            >
              :{pad(m)}
            </button>
          ))}
        </div>

        <PrimaryButton type="button" className="mt-6" onClick={() => onDone(value)}>
          Set {clock12(value)}
        </PrimaryButton>
      </div>
    </div>,
    document.getElementById("ob-root") || document.body,
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
          <span key={x} className="inline-flex items-center gap-1 min-h-[52px] pl-4 pr-1.5 rounded-2xl bg-ob-brand text-white text-[16px] font-semibold animate-ob-pop motion-reduce:animate-none">
            {x}
            <button type="button" aria-label={`Remove ${x}`} onClick={() => onChange(value.filter((v) => v !== x))} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/15">
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
              e.preventDefault(); // add, don't move to the next question
              add();
            }
          }}
          onBlur={add}
          className="!h-[52px] !text-[16px]"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Add"
          className="h-[52px] w-[52px] shrink-0 rounded-2xl bg-ob-brand text-white flex items-center justify-center disabled:opacity-30 transition-opacity"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/** A list of short lines (one medicine per line). Always shows at least one line. */
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
    <div className="space-y-2.5">
      {rows.map((item, i) => (
        <div key={i} className="flex items-center gap-2 animate-ob-fade">
          <TextField
            value={item}
            aria-label={`${itemLabel} ${i + 1}`}
            placeholder={i === 0 ? placeholder : "Another one"}
            autoComplete="off"
            enterKeyHint="next"
            onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))}
            className="!h-[56px] !text-[16px]"
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
      <button type="button" onClick={() => onChange([...rows, ""])} className="inline-flex items-center gap-2.5 h-12 px-1 text-[16px] font-semibold text-ob-brand">
        <span className="w-8 h-8 rounded-full bg-ob-mint flex items-center justify-center">
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
      className={`w-full h-14 rounded-full bg-ob-brand bg-gradient-to-b from-[#1F5A4E] to-ob-brand text-white text-[17px] font-semibold flex items-center justify-center gap-2 shadow-[0_10px_24px_-10px_rgba(23,74,64,0.8)] transition-[transform,opacity] hover:opacity-95 active:scale-[0.99] disabled:opacity-60 ${className}`}
    >
      {loading && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function SecondaryButton({ className = "", children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full h-14 rounded-full border border-ob-line bg-ob-card text-ob-ink text-[17px] font-semibold flex items-center justify-center gap-2 transition-[transform,background-color] hover:bg-ob-soft active:scale-[0.99] ${className}`}
    >
      {children}
    </button>
  );
}
