"use client";

/**
 * Small SVG/HTML chart set for Insights. Follows the dataviz rules: thin marks,
 * 4px rounded data ends on the baseline, 2px gaps between stacked segments,
 * recessive axes, a hover tooltip on every mark, a legend for 2+ series and a
 * table view. Colors are validated for colour-blind separation on the dark
 * surface (see README of the dataviz skill).
 */

import React, { useId, useLayoutEffect, useRef, useState } from "react";

export const SERIES = {
  primary: "#3987e5",
  secondary: "#184f95",
  muted: "#a1a1aa",
};

/* ------------------------------------------------------------------ */
/* Frame, legend, tooltip, table                                       */
/* ------------------------------------------------------------------ */

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
}

export function ChartBlock({
  title,
  subtitle,
  legend,
  table,
  children,
  className = "",
}: {
  title: string;
  subtitle?: React.ReactNode;
  legend?: { label: string; color: string }[];
  table?: TableSpec;
  children: React.ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium text-zinc-100">{title}</h2>
          {subtitle && <p className="text-[12.5px] text-zinc-500 mt-0.5 leading-5">{subtitle}</p>}
        </div>
        {table && (
          <button
            onClick={() => setAsTable(!asTable)}
            className="shrink-0 text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-pressed={asTable}
          >
            {asTable ? "Chart" : "Table"}
          </button>
        )}
      </div>
      {legend && legend.length > 1 && !asTable && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4">{asTable && table ? <DataTable spec={table} /> : children}</div>
    </section>
  );
}

function DataTable({ spec }: { spec: TableSpec }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-zinc-500 text-left">
            {spec.columns.map((c, i) => (
              <th key={c} className={`font-normal pb-2 ${i > 0 ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ay-line">
          {spec.rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j} className={`py-1.5 tabular-nums ${j > 0 ? "text-right text-zinc-300" : "text-zinc-400"}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TipState {
  x: number;
  y: number;
  content: React.ReactNode;
}

function useTip() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const show = (e: React.PointerEvent | React.FocusEvent, content: React.ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const target = (e.currentTarget as Element).getBoundingClientRect();
    const x = "clientX" in e ? e.clientX - box.left : target.left + target.width / 2 - box.left;
    const y = "clientY" in e ? e.clientY - box.top : target.top - box.top;
    setTip({ x, y, content });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-lg bg-ay-raised ring-1 ring-white/[0.08] px-3 py-2 text-[12px] text-zinc-200 shadow-xl"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  ) : null;
  return { ref, show, hide, node };
}

export function TipRow({ color, label, value }: { color?: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 leading-5">
      {color && <span className="w-2 h-2 rounded-[2px]" style={{ background: color }} />}
      <span className="text-zinc-400">{label}</span>
      <span className="ml-auto pl-4 tabular-nums text-zinc-100">{value}</span>
    </div>
  );
}

/** Width of the chart's box in CSS pixels, so SVG text and marks keep their real size. */
function useWidth(ref: React.RefObject<HTMLDivElement | null>, fallback = 640) {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(120, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/* ------------------------------------------------------------------ */
/* Stacked columns (calls per day, calls per hour)                     */
/* ------------------------------------------------------------------ */

/** A column path with a rounded top (radius shrinks for short bars) and a square baseline. */
function roundedTop(x: number, base: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, h, w / 2);
  const t = base - h;
  return `M${x},${base} V${t + r} Q${x},${t} ${x + r},${t} H${x + w - r} Q${x + w},${t} ${x + w},${t + r} V${base} Z`;
}

export interface StackSegment {
  key: string;
  label: string;
  color: string;
}

export function StackedColumns<T extends Record<string, any>>({
  data,
  segments,
  xLabel,
  xTitle,
  height = 180,
  ariaLabel,
}: {
  data: T[];
  segments: StackSegment[];
  xLabel: (d: T, i: number) => string;
  xTitle: (d: T) => string;
  height?: number;
  ariaLabel: string;
}) {
  const tip = useTip();
  const clipBase = useId().replace(/:/g, "");
  const W = useWidth(tip.ref);
  const top = 16;
  const bottom = 22;
  const plotH = height - top - bottom;
  const totals = data.map((d) => segments.reduce((n, s) => n + (Number(d[s.key]) || 0), 0));
  const max = Math.max(1, ...totals);
  const step = W / Math.max(1, data.length);
  const barW = Math.max(6, Math.min(36, step * 0.56));
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(W / 44)));

  return (
    <div ref={tip.ref} className="relative min-w-0">
      <svg height={height} viewBox={`0 0 ${W} ${height}`} className="block w-full" role="img" aria-label={ariaLabel}>
        {/* Recessive grid: baseline and the max line */}
        <line x1={0} x2={W} y1={top + plotH} y2={top + plotH} stroke="rgba(255,255,255,0.08)" />
        <line x1={0} x2={W} y1={top} y2={top} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
        <text x={W} y={top - 5} textAnchor="end" className="fill-zinc-600" fontSize={10.5}>
          {max}
        </text>
        {data.map((d, i) => {
          const cx = step * i + step / 2;
          const x = cx - barW / 2;
          const total = totals[i];
          const colH = (total / max) * plotH;
          let y = top + plotH;
          const clipId = `${clipBase}-${i}`;
          const tipContent = (
            <div className="min-w-[160px]">
              <div className="text-zinc-100 mb-1">{xTitle(d)}</div>
              {segments.map((s) => (
                <TipRow key={s.key} color={s.color} label={s.label} value={Number(d[s.key]) || 0} />
              ))}
            </div>
          );
          return (
            <g key={i}>
              <clipPath id={clipId}>
                {/* Rounded top, square baseline */}
                <path d={roundedTop(x, top + plotH, barW, colH)} />
              </clipPath>
              <g clipPath={`url(#${clipId})`}>
                {segments.map((s, si) => {
                  const v = Number(d[s.key]) || 0;
                  if (!v) return null;
                  const h = (v / max) * plotH;
                  y -= h;
                  const gap = si > 0 ? 2 : 0;
                  return <rect key={s.key} x={x} y={y} width={barW} height={Math.max(0, h - gap)} fill={s.color} />;
                })}
              </g>
              {/* Hit area bigger than the mark */}
              <rect
                x={step * i}
                y={0}
                width={step}
                height={height}
                fill="transparent"
                tabIndex={0}
                data-col={i}
                aria-label={`${xTitle(d)}: ${segments.map((s) => `${s.label} ${Number(d[s.key]) || 0}`).join(", ")}`}
                onPointerMove={(e) => tip.show(e, tipContent)}
                onPointerLeave={tip.hide}
                onFocus={(e) => tip.show(e, tipContent)}
                onBlur={tip.hide}
                className="outline-none focus:fill-white/[0.03] hover:fill-white/[0.03]"
              />
              {i % labelEvery === 0 && (
                <text x={cx} y={height - 6} textAnchor="middle" className="fill-zinc-500" fontSize={10.5}>
                  {xLabel(d, i)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tip.node}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal bars (funnel, distributions, coverage)                   */
/* ------------------------------------------------------------------ */

export interface BarRow {
  label: string;
  value: number;
  /** Shown to the right, e.g. "10 · 67%". */
  display?: React.ReactNode;
  hint?: string;
  color?: string;
}

export function BarList({ rows, max, ariaLabel }: { rows: BarRow[]; max?: number; ariaLabel: string }) {
  const tip = useTip();
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div ref={tip.ref} className="relative" role="list" aria-label={ariaLabel}>
      {rows.map((r) => {
        const width = top > 0 ? (r.value / top) * 100 : 0;
        return (
          <div
            key={r.label}
            role="listitem"
            tabIndex={0}
            className="grid grid-cols-[120px_1fr_auto] sm:grid-cols-[140px_1fr_auto] items-center gap-3 py-1.5 outline-none group"
            onPointerMove={(e) => r.hint && tip.show(e, <span className="text-zinc-300">{r.hint}</span>)}
            onPointerLeave={tip.hide}
            onFocus={(e) => r.hint && tip.show(e, <span className="text-zinc-300">{r.hint}</span>)}
            onBlur={tip.hide}
          >
            <span className="text-[13px] text-zinc-400 truncate group-hover:text-zinc-200">{r.label}</span>
            <span className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max(width, r.value > 0 ? 2 : 0)}%`, background: r.color || SERIES.primary }}
              />
            </span>
            <span className="text-[13px] text-zinc-200 tabular-nums text-right min-w-[64px]">{r.display ?? r.value}</span>
          </div>
        );
      })}
      {tip.node}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Line with points (engagement by call number)                        */
/* ------------------------------------------------------------------ */

export function PointLine({
  points,
  xLabel,
  yLabel,
  tipFor,
  height = 180,
  ariaLabel,
}: {
  points: { x: number; y: number }[];
  xLabel: (x: number) => string;
  yLabel: string;
  tipFor: (i: number) => React.ReactNode;
  height?: number;
  ariaLabel: string;
}) {
  const tip = useTip();
  const [active, setActive] = useState<number | null>(null);
  const W = useWidth(tip.ref);
  const left = 24;
  const right = 24;
  const top = 18;
  const bottom = 22;
  const plotW = W - left - right;
  const plotH = height - top - bottom;
  const maxY = Math.max(1, ...points.map((p) => p.y));
  const n = points.length;
  const px = (i: number) => left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const py = (y: number) => top + plotH - (y / maxY) * plotH;
  const d = points.map((p, i) => `${i ? "L" : "M"}${px(i)},${py(p.y)}`).join(" ");

  return (
    <div ref={tip.ref} className="relative min-w-0">
      <svg height={height} viewBox={`0 0 ${W} ${height}`} className="block w-full" role="img" aria-label={ariaLabel}>
        <line x1={0} x2={W} y1={top + plotH} y2={top + plotH} stroke="rgba(255,255,255,0.08)" />
        <line x1={0} x2={W} y1={top} y2={top} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
        <text x={W} y={top - 6} textAnchor="end" className="fill-zinc-600" fontSize={10.5}>
          {Math.round(maxY)} {yLabel}
        </text>
        {active !== null && (
          <line x1={px(active)} x2={px(active)} y1={top} y2={top + plotH} stroke="rgba(255,255,255,0.12)" />
        )}
        <path d={d} fill="none" stroke={SERIES.primary} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={px(i)} cy={py(p.y)} r={active === i ? 5 : 4} fill={SERIES.primary} stroke="#0B0C0E" strokeWidth={2} />
            <text x={px(i)} y={height - 6} textAnchor="middle" className="fill-zinc-500" fontSize={10.5}>
              {xLabel(p.x)}
            </text>
            <rect
              x={px(i) - (n > 1 ? plotW / (n - 1) / 2 : plotW / 2)}
              y={0}
              width={n > 1 ? plotW / (n - 1) : plotW}
              height={height}
              fill="transparent"
              tabIndex={0}
              className="outline-none"
              aria-label={`${xLabel(p.x)}: ${Math.round(p.y)} ${yLabel}`}
              onPointerMove={(e) => {
                setActive(i);
                tip.show(e, tipFor(i));
              }}
              onPointerLeave={() => {
                setActive(null);
                tip.hide();
              }}
              onFocus={(e) => {
                setActive(i);
                tip.show(e, tipFor(i));
              }}
              onBlur={() => {
                setActive(null);
                tip.hide();
              }}
            />
          </g>
        ))}
      </svg>
      {tip.node}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({ values, width = 88, height = 24, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (values.length < 2) return <span className="text-[12px] text-zinc-600">—</span>;
  const max = Math.max(1, ...values);
  const px = (i: number) => 2 + (i / (values.length - 1)) * (width - 4);
  const py = (v: number) => height - 3 - (v / max) * (height - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${px(i)},${py(v)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg width={width} height={height} role="img" aria-label={label}>
      <title>{label}</title>
      <path d={d} fill="none" stroke={SERIES.primary} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(last)} cy={py(values[last])} r={2.5} fill={SERIES.primary} />
    </svg>
  );
}
