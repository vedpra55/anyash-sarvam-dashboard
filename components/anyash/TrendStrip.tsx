"use client";

import React, { useMemo } from "react";
import { clean, humanize, formatDuration } from "./detail-ui";
import { isConnected } from "@/lib/attention";

type CellTone = "good" | "fair" | "watch";
interface Cell {
  tone: CellTone;
  text: string;
}

const CELL_COLOR: Record<CellTone, string> = {
  good: "bg-[#34d399]",
  fair: "bg-[#52525b]",
  watch: "bg-[#fcd34d]",
};

function localKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MOOD_TONE: Record<string, CellTone> = {
  calm_positive: "good",
  neutral: "fair",
  mixed: "fair",
  low_or_flat: "watch",
  anxious_or_worried: "watch",
  irritable: "watch",
};

type Metric = {
  label: string;
  cell: (log: any | undefined, calls: any[]) => Cell | null;
};

const METRICS: Metric[] = [
  {
    label: "Check-in",
    cell: (_log, calls) => {
      if (calls.length === 0) return null;
      const talked = calls.find(isConnected);
      return talked
        ? { tone: "good", text: `Talked ${formatDuration(talked.duration_seconds)}` }
        : { tone: "watch", text: "Not reached" };
    },
  },
  {
    label: "Sleep",
    cell: (log) => {
      const q = (log?.sleep_quality || "").toLowerCase();
      const hours = log?.sleep_hours ? `${log.sleep_hours} h` : "";
      if (!q && !hours) return null;
      const tone: CellTone = q === "good" ? "good" : q === "interrupted" || q === "poor" ? "watch" : "fair";
      return { tone, text: [hours, humanize(q)].filter(Boolean).join(", ") };
    },
  },
  {
    label: "Pain",
    cell: (log) => {
      const m = log?.mobility_and_pain;
      if (!m || m.pain_reported === null || m.pain_reported === undefined) return null;
      if (!m.pain_reported) return { tone: "good", text: "No pain" };
      const where = Array.isArray(m.locations) && m.locations.length ? m.locations.join(", ") : "";
      return { tone: "watch", text: [where, clean(m.nature)].filter(Boolean).join(" — ") || "Pain reported" };
    },
  },
  {
    label: "Mood",
    cell: (_log, calls) => {
      const mood = calls.find((c) => c.parent_mood)?.parent_mood;
      if (!mood) return null;
      return { tone: MOOD_TONE[mood] || "fair", text: humanize(mood) };
    },
  },
  {
    label: "Appetite",
    cell: (log) => {
      const a = (log?.appetite || log?.meals_reported?.appetite || "").toLowerCase();
      if (!a) return null;
      return { tone: a === "normal" ? "good" : "watch", text: humanize(a) };
    },
  },
  {
    label: "Medicines",
    cell: (log) => {
      const a = (log?.medication_adherence?.adherence || "").toLowerCase();
      if (!a) return null;
      return { tone: a === "taken" ? "good" : "watch", text: humanize(a) };
    },
  },
];

/** A week of daily signals from health logs and calls, oldest on the left. */
export function TrendStrip({ logs, calls }: { logs: any[]; calls: any[] }) {
  const days = useMemo(() => {
    const out: { key: string; date: Date }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      out.push({ key: localKey(d), date: d });
    }
    return out;
  }, []);

  const rows = useMemo(() => {
    const logByDay = new Map<string, any>();
    for (const log of logs) if (log.log_date && !logByDay.has(log.log_date)) logByDay.set(log.log_date, log);
    const callsByDay = new Map<string, any[]>();
    for (const c of calls) {
      if (!c.created_at) continue;
      const k = localKey(new Date(c.created_at));
      callsByDay.set(k, [...(callsByDay.get(k) || []), c]);
    }
    return METRICS.map((m) => {
      const cells = days.map((d) => m.cell(logByDay.get(d.key), callsByDay.get(d.key) || []));
      const latest = [...cells].reverse().find(Boolean) || null;
      return { label: m.label, cells, latest };
    }).filter((r) => r.latest);
  }, [logs, calls, days]);

  if (rows.length === 0) {
    return <p className="text-[13px] text-zinc-500">Trends appear after a few check-ins.</p>;
  }

  const cols = "grid grid-cols-[88px_repeat(7,20px)_1fr] items-center gap-x-1.5";

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="min-w-[440px]">
        <div className={`${cols} pb-2`} aria-hidden="true">
          <span />
          {days.map((d, i) => (
            <span key={d.key} className={`text-[11px] text-center ${i === 6 ? "text-zinc-300" : "text-zinc-600"}`}>
              {i === 6 ? "T" : d.date.toLocaleDateString([], { weekday: "narrow" })}
            </span>
          ))}
          <span className="pl-4 text-[11px] text-zinc-600">Latest</span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className={`${cols} py-1.5`} role="row" aria-label={`${row.label}: ${row.latest!.text}`}>
            <span className="text-[13px] text-zinc-500">{row.label}</span>
            {row.cells.map((cell, i) => (
              <span
                key={days[i].key}
                title={`${days[i].date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}: ${cell ? cell.text : "No data"}`}
                className={`h-5 rounded-[4px] ${cell ? CELL_COLOR[cell.tone] : "bg-white/[0.04]"}`}
              />
            ))}
            <span className="pl-4 text-[13px] text-zinc-300 truncate">{row.latest!.text}</span>
          </div>
        ))}
        <div className="flex items-center gap-4 pt-3 text-[11.5px] text-zinc-600">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-[#34d399]" />Fine</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-[#52525b]" />So-so</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-[#fcd34d]" />Worth a look</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-white/[0.06]" />No data</span>
        </div>
      </div>
    </div>
  );
}
