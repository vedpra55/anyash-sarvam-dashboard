"use client";

import React from "react";
import { ParsedMemory, MemoryDiff, MemoryLogEntry } from "@/lib/memory";

/* ------------------------------------------------------------------ */
/* Layout primitives: typography and spacing instead of boxes.         */
/* ------------------------------------------------------------------ */

export function Section({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`pt-8 ${className}`}>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="text-[13px] font-medium text-zinc-500">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A label / value row. Stacks on narrow widths. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[128px_1fr] gap-x-6 gap-y-0.5 py-2">
      <dt className="text-[13px] text-zinc-500 leading-6">{label}</dt>
      <dd className="text-[13px] text-zinc-200 leading-6 min-w-0 break-words">{children}</dd>
    </div>
  );
}

export type Tone = "good" | "watch" | "notify" | "urgent" | "neutral";

const TONE_DOT: Record<Tone, string> = {
  good: "bg-emerald-400",
  watch: "bg-amber-300",
  notify: "bg-orange-400",
  urgent: "bg-rose-500",
  neutral: "bg-zinc-500",
};

const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-300",
  watch: "text-amber-200",
  notify: "text-orange-300",
  urgent: "text-rose-300",
  neutral: "text-zinc-300",
};

const TONE_BAR: Record<Tone, string> = {
  good: "bg-emerald-400/70",
  watch: "bg-amber-300/80",
  notify: "bg-orange-400/80",
  urgent: "bg-rose-500",
  neutral: "bg-zinc-600",
};

export function Dot({ tone, className = "" }: { tone: Tone; className?: string }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[tone]} ${className}`} />;
}

export function StatusLabel({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-2 ${TONE_TEXT[tone]}`}>
      <Dot tone={tone} />
      {children}
    </span>
  );
}

/** A highlighted note marked by a thin left rule — no box. */
export function Callout({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative pl-4">
      <span className={`absolute left-0 top-1 bottom-1 w-[2px] rounded-full ${TONE_BAR[tone]}`} />
      <div className={`text-[13px] font-medium ${TONE_TEXT[tone]}`}>{title}</div>
      {children && <div className="text-[13px] text-zinc-300 leading-6 mt-0.5">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

export function humanize(value?: string | null): string {
  if (!value) return "";
  const s = value.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FILLER = /\b(not reported|not specified|unspecified|no .{0,30}(update|information|details?) (reported|shared|given))\b/i;

/**
 * Removes filler clauses the AI adds when nothing was said
 * ("Hours not reported.", "specific food not reported"). Returns "" if
 * nothing meaningful is left.
 */
export function clean(value?: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text || /^(null|none|n\/a|no|-)$/i.test(text)) return "";
  const parts = text
    .replace(/([.;])\s+/g, "$1\u0000")
    .split("\u0000")
    .map((p) => p.trim())
    .filter((p) => p && !FILLER.test(p));
  return parts.join(" ").replace(/[;,]\s*$/, "").trim();
}

export function formatDuration(sec?: number | string | null): string {
  const s = Math.round(Number(sec) || 0);
  if (s <= 0) return "0s";
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

/* ------------------------------------------------------------------ */
/* Decision + call status vocabulary                                   */
/* ------------------------------------------------------------------ */

export function decisionMeta(decision?: string | null, urgency?: string | null): { label: string; tone: Tone } {
  switch ((decision || "").toUpperCase()) {
    case "ESCALATION":
      return { label: "Escalate now", tone: "urgent" };
    case "FAMILY_NOTIFICATION":
      return { label: "Let the family know", tone: "notify" };
    case "MONITOR":
      return { label: "Keep an eye on it", tone: "watch" };
    case "NORMAL":
      return { label: "No concerns", tone: "good" };
  }
  if (urgency === "urgent") return { label: "Urgent", tone: "urgent" };
  if (urgency === "medium") return { label: "Needs attention", tone: "notify" };
  return { label: "Assessed", tone: "neutral" };
}

export function callStatusMeta(status?: string | null): { label: string; tone: Tone } {
  switch (status) {
    case "connected":
    case "completed":
      return { label: "Connected", tone: "good" };
    case "busy":
      return { label: "Busy", tone: "watch" };
    case "no_answer":
    case "no-answer":
      return { label: "No answer", tone: "watch" };
    case "failed":
    case "error":
      return { label: "Failed", tone: "urgent" };
    default:
      return { label: humanize(status) || "Unknown", tone: "neutral" };
  }
}

/* ------------------------------------------------------------------ */
/* Memory rendering                                                    */
/* ------------------------------------------------------------------ */

function LogEntry({ entry }: { entry: MemoryLogEntry }) {
  return (
    <div className="py-3">
      <div className="text-[13px] font-medium text-zinc-200">{entry.title}</div>
      {entry.items.length > 0 && (
        <dl className="mt-1">
          {entry.items.map((item, i) =>
            item.label ? (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[128px_1fr] gap-x-6 py-0.5">
                <dt className="text-[13px] text-zinc-500 leading-6">{item.label}</dt>
                <dd className="text-[13px] text-zinc-300 leading-6">{item.text}</dd>
              </div>
            ) : (
              <p key={i} className="text-[13px] text-zinc-300 leading-6">
                {item.text}
              </p>
            )
          )}
        </dl>
      )}
    </div>
  );
}

/** Renders a parsed memory as a readable document. */
export function MemoryDocument({ memory }: { memory: ParsedMemory }) {
  const [, ...baselineRest] = memory.baseline;

  return (
    <div>
      <Section title="Watching for" className="pt-0">
        {memory.watchlist.length > 0 ? (
          <ul className="space-y-1.5">
            {memory.watchlist.map((item, i) => (
              <li key={i} className="flex gap-3 text-[14px] text-zinc-100 leading-6">
                <Dot tone="watch" className="mt-[9px]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-zinc-500">Nothing on the watch list.</p>
        )}
      </Section>

      {(baselineRest.length > 0 || memory.routine.length > 0) && (
        <Section title="About">
          <dl>
            {baselineRest.length > 0 && (
              <Field label="Baseline">
                {baselineRest.map((b, i) => (
                  <div key={i}>{b}</div>
                ))}
              </Field>
            )}
            {memory.routine.length > 0 && (
              <Field label="Routine">
                {memory.routine.map((r, i) => (
                  <div key={i}>{r}</div>
                ))}
              </Field>
            )}
          </dl>
        </Section>
      )}

      {memory.log.length > 0 && (
        <Section title="Recent calls">
          <div className="divide-y divide-white/[0.05]">
            {memory.log.map((entry, i) => (
              <LogEntry key={i} entry={entry} />
            ))}
          </div>
        </Section>
      )}

      {memory.other.length > 0 && (
        <Section title="Other notes">
          {memory.other.map((line, i) => (
            <p key={i} className="text-[13px] text-zinc-300 leading-6">
              {line}
            </p>
          ))}
        </Section>
      )}
    </div>
  );
}

export function summarizeDiff(diff: MemoryDiff): string {
  const parts: string[] = [];
  if (diff.watchlistAdded.length) parts.push(`${diff.watchlistAdded.length} new to watch`);
  if (diff.watchlistResolved.length) parts.push(`${diff.watchlistResolved.length} dropped`);
  if (diff.logAdded.length) parts.push("call logged");
  if (diff.routineChanged) parts.push("routine updated");
  if (diff.baselineChanged) parts.push("baseline updated");
  return parts.length ? parts.join(" · ") : "No changes";
}

/** What changed in memory on one call. */
export function MemoryDiffView({ diff, after }: { diff: MemoryDiff; after: ParsedMemory }) {
  const nothing =
    !diff.watchlistAdded.length &&
    !diff.watchlistResolved.length &&
    !diff.watchlistKept.length &&
    !diff.logAdded.length &&
    !diff.routineChanged &&
    !diff.baselineChanged;

  if (nothing) {
    return <p className="text-[13px] text-zinc-500">Memory did not change on this call.</p>;
  }

  return (
    <div className="space-y-6">
      {(diff.watchlistAdded.length > 0 ||
        diff.watchlistResolved.length > 0 ||
        diff.watchlistKept.length > 0) && (
        <div>
          <div className="text-[13px] text-zinc-500 mb-2">Watch list</div>
          <ul className="space-y-1.5">
            {diff.watchlistAdded.map((w, i) => (
              <li key={`a${i}`} className="flex gap-3 text-[13px] leading-6">
                <span className="w-16 shrink-0 text-emerald-300">New</span>
                <span className="text-zinc-100">{w}</span>
              </li>
            ))}
            {diff.watchlistKept.map((w, i) => (
              <li key={`k${i}`} className="flex gap-3 text-[13px] leading-6">
                <span className="w-16 shrink-0 text-zinc-500">Kept</span>
                <span className="text-zinc-300">{w}</span>
              </li>
            ))}
            {diff.watchlistResolved.map((w, i) => (
              <li key={`r${i}`} className="flex gap-3 text-[13px] leading-6">
                <span className="w-16 shrink-0 text-zinc-500">Dropped</span>
                <span className="text-zinc-500 line-through decoration-zinc-600">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.logAdded.length > 0 && (
        <div>
          <div className="text-[13px] text-zinc-500">Added to recent calls</div>
          <div className="divide-y divide-white/[0.05]">
            {diff.logAdded.map((entry, i) => (
              <LogEntry key={i} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {(diff.routineChanged || diff.baselineChanged) && (
        <dl>
          {diff.baselineChanged && after.baseline.length > 1 && (
            <Field label="Baseline now">{after.baseline.slice(1).join(" · ")}</Field>
          )}
          {diff.routineChanged && after.routine.length > 0 && (
            <Field label="Routine now">{after.routine.join(" · ")}</Field>
          )}
        </dl>
      )}
    </div>
  );
}
