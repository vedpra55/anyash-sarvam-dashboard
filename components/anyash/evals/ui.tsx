"use client";

import React from "react";
import { CHECK_INFO, type CheckId, type CheckResult, type Turn } from "@/lib/evals";

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`);

const ENDED: Record<string, string> = {
  agent_end: "Agent closed the call",
  parent_hangup: "Parent hung up",
  cutoff: "Hit the 240 s limit",
  limit: "Hit the turn limit",
};
export const endedLabel = (e: string | null | undefined) => (e ? ENDED[e] || e : "");

export function Pill({ tone, children, title }: { tone: "good" | "bad" | "neutral" | "warn"; children: React.ReactNode; title?: string }) {
  const tones = {
    good: "bg-emerald-400/10 text-emerald-300",
    bad: "bg-rose-500/10 text-rose-300",
    neutral: "bg-white/[0.05] text-zinc-400",
    warn: "bg-amber-300/10 text-amber-200",
  };
  return (
    <span title={title} className={`inline-flex items-center h-6 px-2.5 rounded-full text-[12px] whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function CheckPill({ check }: { check: CheckResult }) {
  const info = CHECK_INFO[check.id as CheckId];
  const label = info?.label || check.id.replace(/^criterion:/, "").replace(/_/g, " ");
  return (
    <Pill tone={check.pass === null ? "neutral" : check.pass ? "good" : "bad"} title={check.reason}>
      {check.pass === null ? "– " : check.pass ? "✓ " : "✕ "}
      {label}
    </Pill>
  );
}

export function Transcript({ turns, empty = "No conversation yet." }: { turns: Turn[]; empty?: string }) {
  if (!turns.length) return <p className="text-[13px] text-zinc-600">{empty}</p>;
  return (
    <div className="space-y-2">
      {turns.map((t, i) => (
        <div key={i} className={`flex ${t.role === "agent" ? "justify-start" : "justify-end"}`}>
          <div
            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-6 ${
              t.role === "agent" ? "bg-white/[0.05] text-zinc-100 rounded-bl-md" : "bg-ay-accent/15 text-amber-100 rounded-br-md"
            }`}
          >
            <span className="block text-[11px] uppercase tracking-wide text-zinc-500 mb-0.5">{t.role === "agent" ? "Anyash" : "Parent"}</span>
            {t.text || <em className="text-zinc-500">(silence)</em>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CheckList({ checks, criteria }: { checks: CheckResult[]; criteria?: CheckResult[] }) {
  const rows = [...checks, ...(criteria || []).map((c) => ({ ...c, id: `criterion:${c.id}` }))];
  return (
    <ul className="divide-y divide-white/[0.05]">
      {rows.map((c) => {
        const info = CHECK_INFO[c.id as CheckId];
        return (
          <li key={c.id} className="py-2 grid grid-cols-[150px_1fr] gap-4 text-[13px]">
            <span className={c.pass === null ? "text-zinc-500" : c.pass ? "text-emerald-300" : "text-rose-300"}>
              {c.pass === null ? "– " : c.pass ? "✓ " : "✕ "}
              {info?.label || c.id.replace(/^criterion:/, "").replace(/_/g, " ")}
            </span>
            <span className="text-zinc-400 leading-6 min-w-0 break-words">{c.reason}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-3">
      <h2 className="text-[13px] font-medium text-zinc-500">{children}</h2>
      {aside}
    </div>
  );
}
