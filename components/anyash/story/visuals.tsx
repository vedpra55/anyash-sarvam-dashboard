"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Area, Day, Mark, Story } from "@/lib/story";
import { shortDate, weekdayShort } from "@/lib/story";
import { AREA_ACCENT, AREA_LABEL, AreaIcon, SparkIcon, StarIcon } from "./icons";

/* ------------------------------------------------------------------ */
/* Status marks                                                        */
/* ------------------------------------------------------------------ */

export const MARK_LABEL: Record<Mark, string> = {
  g: "Good",
  o: "Okay",
  w: "Keep an eye",
  a: "Something happened",
  n: "Not mentioned",
  x: "No conversation",
};

const MARK_FILL: Record<Mark, string> = {
  g: "#34D399",
  o: "rgba(52, 211, 153, .42)",
  w: "#FCD34D",
  a: "#F43F5E",
  n: "transparent",
  x: "#27272A",
};

export function MarkDot({ mark, size = 12, i = 0, title }: { mark: Mark; size?: number; i?: number; title?: string }) {
  const s = mark === "x" ? Math.round(size * 0.45) : size;
  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size, ["--i" as string]: i } as React.CSSProperties}
    >
      <span
        className="block rounded-full"
        style={{ width: s, height: s, background: MARK_FILL[mark], boxShadow: mark === "n" ? "inset 0 0 0 1.5px #52525B" : undefined }}
      />
    </span>
  );
}

/** A tiny face for the Mood strip; the mouth follows the mark. */
export function MoodFace({ mark, size = 14, i = 0, title }: { mark: Mark; size?: number; i?: number; title?: string }) {
  if (mark === "x" || mark === "n") return <MarkDot mark={mark} size={size} i={i} title={title} />;
  const color = mark === "w" || mark === "a" ? "#FCD34D" : mark === "o" ? "rgba(254, 229, 165, .6)" : "#FEE5A5";
  const mouth = mark === "w" || mark === "a" ? "M8 16.2c2.2-1.6 5.8-1.6 8 0" : mark === "o" ? "M8 15h8" : "M7.8 14c2.3 2.4 6.1 2.4 8.4 0";
  return (
    <span title={title} aria-label={title} className="inline-flex shrink-0" style={{ width: size, height: size, ["--i" as string]: i } as React.CSSProperties}>
      <svg viewBox="0 0 24 24" className="w-full h-full" aria-hidden>
        <circle cx="12" cy="12" r="11" fill={color} />
        <circle cx="8.6" cy="10" r="1.5" fill="#0B0C0E" />
        <circle cx="15.4" cy="10" r="1.5" fill="#0B0C0E" />
        <path d={mouth} stroke="#0B0C0E" strokeWidth={2} fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function MarkLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-zinc-500">
      {(["g", "o", "w", "n", "x"] as Mark[]).map((m) => (
        <span key={m} className="inline-flex items-center gap-1.5">
          <MarkDot mark={m} size={10} />
          {MARK_LABEL[m]}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

/** Counts up from 0 when `live` (Present mode); otherwise shows the value. */
export function CountUp({ value, live }: { value: number; live?: boolean }) {
  const [shown, setShown] = useState(value);
  const raf = useRef(0);
  useEffect(() => {
    if (!live || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const startAt = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - startAt) / 900);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    setShown(0);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, live]);
  return <>{shown}</>;
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

/** Gold, brighter for longer conversations. */
function goldFor(minutes: number) {
  const a = minutes >= 4 ? 1 : minutes >= 2.5 ? 0.78 : minutes >= 1.5 ? 0.58 : 0.4;
  return `rgba(254, 229, 165, ${a})`;
}

export function StoryCalendar({ story }: { story: Story }) {
  const days = story.days;
  if (!days.length) return null;
  const lead = (new Date(`${days[0].key}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday first
  const cells: (Day | null)[] = [...Array(lead).fill(null), ...days];
  return (
    <div>
      <div className="inline-grid grid-cols-[repeat(7,36px)] sm:grid-cols-[repeat(7,40px)] gap-1.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-[11px] font-medium text-zinc-600 pb-1">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`b${i}`} />;
          const isToday = d.key === story.today;
          const first = d.key === story.firstCall;
          const talked = d.state === "talked";
          const label = `${weekdayShort(d.key)} ${shortDate(d.key)}: ${
            talked ? `talked${d.minutes ? `, ${d.minutes} min` : ""}` : d.state === "missed" ? "called, no answer" : "not called"
          }${first ? " · first call" : ""}${d.moment ? " · shared a life moment" : ""}`;
          return (
            <div
              key={d.key}
              title={label}
              aria-label={label}
              style={{ background: talked ? goldFor(d.minutes) : undefined } as React.CSSProperties}
              className={`relative aspect-square rounded-[9px] flex items-center justify-center ${
                talked ? "" : d.state === "missed" ? "ring-[1.5px] ring-inset ring-[rgba(254,229,165,.38)]" : "bg-white/[0.04]"
              } ${isToday ? "outline outline-2 outline-offset-2 outline-zinc-200/80 ay-breathe" : ""}`}
            >
              <span className={`text-[12px] tabular-nums font-semibold ${talked ? "text-black/60" : d.state === "missed" ? "text-zinc-400" : "text-zinc-600"}`}>
                {Number(d.key.slice(8))}
              </span>
              {(first || d.moment) && (
                <span className="absolute -top-1.5 -right-1.5 w-[17px] h-[17px] rounded-full bg-ay-canvas ring-1 ring-white/10 flex items-center justify-center">
                  {first ? <StarIcon className="w-[11px] h-[11px]" /> : <SparkIcon className="w-[11px] h-[11px]" />}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="flex gap-0.5">
            {[1, 2, 3, 4].map((m) => (
              <span key={m} className="w-2.5 h-2.5 rounded-[3px]" style={{ background: goldFor(m) }} />
            ))}
          </span>
          Talked, brighter is longer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] ring-[1.25px] ring-inset ring-[rgba(254,229,165,.45)]" />
          No answer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-white/[0.07]" />
          Not called
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StarIcon className="w-3 h-3" />
          First call
        </span>
        <span className="inline-flex items-center gap-1.5">
          <SparkIcon className="w-3 h-3" />
          Life moment
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conversation pulse                                                  */
/* ------------------------------------------------------------------ */

/** Smooth path through points (Catmull-Rom as cubic Béziers). */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function ConversationPulse({ story, days: count = 28 }: { story: Story; days?: number }) {
  const days = story.days.slice(-count);
  if (days.length < 2) return <p className="text-[13px] text-zinc-500">The chart starts after a second day of calls.</p>;
  const W = 760;
  const H = 170;
  const pad = { l: 8, r: 92, t: 30, b: 26 };
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const top = Math.ceil(max);
  const x = (i: number) => pad.l + (i / (days.length - 1)) * (W - pad.l - pad.r);
  const y = (m: number) => pad.t + (1 - m / top) * (H - pad.t - pad.b);
  // Cap the curve inside the plot so the smoothing never dips below zero.
  const pts = days.map((d, i) => [Number(x(i).toFixed(1)), Number(Math.min(y(0), y(d.minutes)).toFixed(1))] as [number, number]);
  const line = smooth(pts);
  const area = `${line} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`;
  const peak = days.reduce((b, d, i) => (d.minutes > days[b].minutes ? i : b), 0);
  const last = days.length - 1;
  const lastMin = days[last].minutes;
  const gid = "pulse-fill";
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px] h-auto" role="img" aria-label={`Minutes talked per day over the last ${days.length} days. Longest: ${days[peak].minutes} minutes on ${shortDate(days[peak].key)}.`}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FEE5A5" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#FEE5A5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, top].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.06)" />
            <text x={W - pad.r + 8} y={y(v) + 4} fontSize="11" fill="#71717A">{v === 0 ? "0" : `${v} min`}</text>
          </g>
        ))}
        {/* Days without a conversation sit on the baseline as small ticks. */}
        {days.map((d, i) => d.state !== "talked" && <circle key={d.key} cx={x(i)} cy={y(0)} r={2} fill={d.state === "missed" ? "rgba(254,229,165,.45)" : "#3F3F46"} />)}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} className="ay-line" style={{ ["--len" as string]: 2000 } as React.CSSProperties} fill="none" stroke="#FEE5A5" strokeWidth={2.2} strokeLinecap="round" />
        {days[peak].minutes > 0 && peak !== last && (
          <g>
            <circle cx={x(peak)} cy={y(days[peak].minutes)} r={3.5} fill="#0B0C0E" stroke="#FEE5A5" strokeWidth={1.8} />
            <text x={Math.min(x(peak), W - pad.r - 120)} y={y(days[peak].minutes) - 12} fontSize="12" fill="#D4D4D8">
              Longest chat · {days[peak].minutes} min
            </text>
          </g>
        )}
        <circle cx={x(last)} cy={y(lastMin)} r={5} fill="#FEE5A5" />
        <text x={x(last) + 10} y={y(lastMin) + 4} fontSize="12.5" fontWeight="600" fill="#FAFAFA">
          {lastMin ? `${lastMin} min today` : "Not yet today"}
        </text>
        <text x={pad.l} y={H - 6} fontSize="11" fill="#71717A">{shortDate(days[0].key)}</text>
        <text x={x(Math.floor(last / 2))} y={H - 6} fontSize="11" fill="#71717A" textAnchor="middle">{shortDate(days[Math.floor(last / 2)].key)}</text>
        <text x={x(last)} y={H - 6} fontSize="11" fill="#71717A" textAnchor="end">Today</text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Health strips                                                       */
/* ------------------------------------------------------------------ */

export function Strip({ area, marks, keys, size = 12 }: { area: Area; marks: Mark[]; keys: string[]; size?: number }) {
  return (
    <div className="ay-dots flex items-center gap-[5px] sm:gap-1.5 flex-wrap">
      {marks.map((m, i) => {
        const title = `${shortDate(keys[i])}: ${MARK_LABEL[m]}`;
        return area === "mood" ? (
          <MoodFace key={keys[i]} mark={m} size={size + 2} i={i} title={title} />
        ) : (
          <MarkDot key={keys[i]} mark={m} size={size} i={i} title={title} />
        );
      })}
    </div>
  );
}

const WORD_COLOR: Record<Mark, string> = {
  g: "text-emerald-300",
  o: "text-emerald-300/80",
  w: "text-amber-200",
  a: "text-rose-300",
  n: "text-zinc-500",
  x: "text-zinc-500",
};

export function AreaRow({
  area,
  word,
  mark,
  children,
  aside,
  live,
}: {
  area: Area;
  word: string;
  mark: Mark;
  children: React.ReactNode;
  aside?: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)] sm:grid-cols-[36px_150px_minmax(0,1fr)_minmax(0,auto)] items-center gap-x-4 gap-y-2 py-3.5">
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center row-span-2 sm:row-span-1"
        style={{ background: `${AREA_ACCENT[area]}14`, color: "#E4E4E7" }}
      >
        <AreaIcon area={area} className="w-[22px] h-[22px]" live={live} mark={mark} />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] text-zinc-100 font-medium">{AREA_LABEL[area]}</p>
        <p className={`text-[12.5px] ${WORD_COLOR[mark]}`}>{word}</p>
      </div>
      <div className="min-w-0 col-start-2 sm:col-start-auto">{children}</div>
      {aside && <div className="hidden sm:block text-[12.5px] text-zinc-500 text-right max-w-[220px] truncate">{aside}</div>}
    </div>
  );
}

/** Small bars (oldest first) with a written trend, e.g. pain mentions per week. */
export function TrendBars({ values, unit, color = "#FDA4AF" }: { values: number[]; unit: string; color?: string }) {
  const max = Math.max(1, ...values);
  const first = values[0];
  const lastV = values[values.length - 1];
  const trend = lastV < first ? "getting better" : lastV > first ? "more often" : "about the same";
  return (
    <span className="inline-flex items-end gap-2">
      <span className="ay-bars flex items-end gap-[3px] h-6" aria-hidden>
        {values.map((v, i) => (
          <span key={i} className="w-[7px] rounded-[2px]" style={{ height: `${Math.max(12, (v / max) * 100)}%`, background: v ? color : "#3F3F46", ["--i" as string]: i } as React.CSSProperties} />
        ))}
      </span>
      <span className="text-[12px] text-zinc-500 whitespace-nowrap">
        {values.join(" → ")} {unit}, {trend}
      </span>
    </span>
  );
}

/** Seven (or more) talk dots for a period: gold = talked, ring = no answer, grey = not called. */
export function TalkDots({ days, size = 22 }: { days: Day[]; size?: number }) {
  return (
    <div className="ay-dots flex flex-wrap gap-1.5">
      {days.map((d, i) => (
        <span
          key={d.key}
          title={`${weekdayShort(d.key)} ${shortDate(d.key)}: ${d.state === "talked" ? "talked" : d.state === "missed" ? "no answer" : "not called"}`}
          className="rounded-full flex items-center justify-center text-[10px] font-semibold"
          style={{
            width: size,
            height: size,
            ["--i" as string]: i,
            background: d.state === "talked" ? goldFor(Math.max(2.5, d.minutes)) : d.state === "missed" ? "transparent" : "rgba(255,255,255,.05)",
            boxShadow: d.state === "missed" ? "inset 0 0 0 1.5px rgba(254,229,165,.45)" : undefined,
            color: d.state === "talked" ? "rgba(0,0,0,.6)" : "#71717A",
          } as React.CSSProperties}
        >
          {weekdayShort(d.key).charAt(0)}
        </span>
      ))}
    </div>
  );
}

