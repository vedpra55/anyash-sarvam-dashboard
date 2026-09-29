"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { insightsQuery } from "@/lib/queries";
import {
  computeInsights,
  formatClock,
  formatHour,
  Headline,
  MIN_CALLS_FOR_FINDINGS,
  RangeId,
  SHORT_CALL_SEC,
} from "@/lib/insights";
import { Button, EmptyState, Segmented } from "@/components/anyash/primitives";
import { Dot, humanize, formatDuration, formatRelative } from "@/components/anyash/detail-ui";
import { Bone } from "@/components/anyash/Skeletons";
import { BarList, ChartBlock, PointLine, SERIES, Sparkline, StackedColumns, TipRow } from "@/components/anyash/charts";

const RANGES: { id: RangeId; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "trial", label: "Whole trial" },
];

const pct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits)}%`;

function dayLabel(day: string, style: "short" | "long" = "short") {
  const d = new Date(`${day}T12:00:00Z`);
  return style === "short"
    ? String(d.getUTCDate())
    : d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Stat({
  label,
  value,
  detail,
  delta,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
  delta?: { value: number | null; unit: "pt" | "s" } | null;
}) {
  let deltaNode: React.ReactNode = null;
  if (delta && delta.value !== null && Math.abs(delta.value) >= (delta.unit === "pt" ? 0.5 : 1)) {
    const up = delta.value > 0;
    deltaNode = (
      <span className="text-[12px] text-zinc-400 tabular-nums">
        {up ? "▲" : "▼"} {Math.abs(delta.value).toFixed(0)}
        {delta.unit === "pt" ? " pts" : " s"} vs previous
      </span>
    );
  }
  return (
    <div className="py-5 sm:py-0">
      <div className="text-[12.5px] text-zinc-500">{label}</div>
      <div className="mt-1.5 text-[30px] leading-none font-semibold text-white tracking-tight tabular-nums">{value}</div>
      <div className="mt-2 flex flex-col gap-0.5 text-[12.5px] text-zinc-500 leading-5">
        {detail}
        {deltaNode}
      </div>
    </div>
  );
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-4">
      <h2 className="text-[13px] font-medium text-zinc-500">{children}</h2>
      {aside}
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading insights</span>
      <div className="mt-10 space-y-4">
        {[80, 65, 72].map((w, i) => (
          <div key={i} className="space-y-2">
            <Bone className="h-4" style={{ width: `${w * 0.6}%` }} />
            <Bone className="h-3" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2.5">
            <Bone className="h-3 w-24" />
            <Bone className="h-8 w-20" />
            <Bone className="h-3 w-28" />
          </div>
        ))}
      </div>
      <Bone className="mt-12 h-[180px] w-full rounded-lg" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function InsightsPage() {
  const query = useQuery(insightsQuery);
  const [range, setRange] = useState<RangeId>("trial");
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const ins = useMemo(() => (query.data ? computeInsights(query.data, range, Date.now()) : null), [query.data, range]);
  const ledger = query.data;

  const delta = (key: keyof Headline, unit: "pt" | "s") => {
    if (!ins?.previous) return null;
    const a = ins.headline[key] as number | null;
    const b = ins.previous[key] as number | null;
    if (a === null || b === null) return null;
    return { value: unit === "pt" ? (a - b) * 100 : a - b, unit };
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1080px] mx-auto px-5 sm:px-10 py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold text-white tracking-tight">Insights</h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              Real check-in calls since the trial started on 25 Sep
              {ins && (
                <>
                  <span className="text-zinc-700 mx-2">·</span>
                  {ins.sample.calls} {ins.sample.calls === 1 ? "call" : "calls"}
                  <span className="text-zinc-700 mx-2">·</span>
                  {ins.parents.length} {ins.parents.length === 1 ? "parent" : "parents"}
                </>
              )}
            </p>
          </div>
          <Segmented value={range} onChange={setRange} options={RANGES} />
        </div>

        {query.isPending ? (
          <InsightsSkeleton />
        ) : query.isError && !ledger ? (
          <EmptyState title="Couldn't load insights." action={<Button size="sm" onClick={() => query.refetch()}>Try again</Button>}>
            {query.error.message}
          </EmptyState>
        ) : !ins || ins.sample.calls === 0 ? (
          <EmptyState title="No real calls in this period.">
            Test calls are excluded. Pick a longer range, or place a call from the Parents page.
          </EmptyState>
        ) : (
          <>
            {query.isError && (
              <p className="mt-4 text-[12.5px] text-amber-200/80">Couldn&apos;t refresh just now; showing the last loaded data.</p>
            )}

            {/* 1. What the data says */}
            <section className="mt-10">
              <SectionTitle>What the data says</SectionTitle>
              {ins.findings.length === 0 ? (
                <p className="text-[14px] text-zinc-400 border-t border-ay-line pt-4">
                  Not enough calls yet: findings appear after {MIN_CALLS_FOR_FINDINGS} connected calls in this period.
                </p>
              ) : (
                <ul className="divide-y divide-ay-line border-t border-ay-line">
                  {ins.findings.map((f) => (
                    <li key={f.id} className="py-4 grid grid-cols-[14px_1fr] gap-x-3">
                      <Dot tone={f.tone === "watch" ? "watch" : f.tone === "good" ? "good" : "neutral"} className="mt-[8px]" />
                      <div>
                        <p className="text-[15px] text-zinc-100 leading-6">{f.title}</p>
                        <p className="text-[13px] text-zinc-500 leading-6 mt-0.5">{f.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 2. Headline numbers */}
            <section className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-x-8 sm:gap-y-8 border-t border-ay-line pt-6 divide-y sm:divide-y-0 divide-ay-line">
              <Stat
                label="Daily check-in coverage"
                value={pct(ins.headline.coverage)}
                detail={
                  ins.headline.coverageDays > 0
                    ? `Parent-days with a real conversation, over ${ins.headline.coverageDays} completed ${ins.headline.coverageDays === 1 ? "day" : "days"}`
                    : "Needs one full day of calls"
                }
                delta={delta("coverage", "pt")}
              />
              <Stat
                label="Goal met"
                value={pct(ins.headline.goalRate)}
                detail={`${ins.headline.goalMet} of ${ins.headline.connected} connected calls`}
                delta={delta("goalRate", "pt")}
              />
              <Stat
                label="Picked up"
                value={pct(ins.headline.connectRate)}
                detail={`${ins.headline.connected} of ${ins.headline.calls} calls`}
                delta={delta("connectRate", "pt")}
              />
              <Stat
                label="Typical call"
                value={ins.headline.medianTalkSec !== null ? formatDuration(ins.headline.medianTalkSec) : "—"}
                detail="Median length of connected calls"
                delta={delta("medianTalkSec", "s")}
              />
            </section>

            {/* 3. Calls per day */}
            <ChartBlock
              className="mt-14"
              title="Calls per day"
              subtitle="Each bar is one day in India time. Goal met means Sarvam's Call Goal passed."
              legend={[
                { label: "Goal met", color: SERIES.primary },
                { label: "Talked, goal not met", color: SERIES.secondary },
                { label: "Didn't connect", color: SERIES.muted },
              ]}
              table={{
                columns: ["Day", "Goal met", "Talked, goal not met", "Didn't connect"],
                rows: ins.daily.map((d) => [dayLabel(d.day, "long"), d.goalMet, d.talked, d.notConnected]),
              }}
            >
              <StackedColumns
                ariaLabel="Calls per day, split by outcome"
                data={ins.daily}
                segments={[
                  { key: "goalMet", label: "Goal met", color: SERIES.primary },
                  { key: "talked", label: "Talked, goal not met", color: SERIES.secondary },
                  { key: "notConnected", label: "Didn't connect", color: SERIES.muted },
                ]}
                xLabel={(d) => dayLabel(d.day)}
                xTitle={(d) => dayLabel(d.day, "long")}
              />
            </ChartBlock>

            {/* 4. Funnel + endings */}
            <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-14">
              <ChartBlock
                title="From dial to a useful conversation"
                subtitle="Where calls drop out on the way to a health update."
                table={{
                  columns: ["Step", "Calls", "Of dialed"],
                  rows: ins.funnel.map((s) => [s.label, s.count, pct(s.count / (ins.funnel[0].count || 1))]),
                }}
              >
                <BarList
                  ariaLabel="Call funnel"
                  max={ins.funnel[0].count}
                  rows={ins.funnel.map((s) => ({
                    label: s.label,
                    value: s.count,
                    hint: s.hint,
                    display: (
                      <>
                        {s.count}
                        <span className="text-zinc-600 ml-1.5">{pct(s.count / (ins.funnel[0].count || 1))}</span>
                      </>
                    ),
                  }))}
                />
              </ChartBlock>

              <ChartBlock
                title="How calls end"
                subtitle="Connected calls only."
                table={{ columns: ["Ending", "Calls"], rows: ins.endings.map((e) => [e.label, e.count]) }}
              >
                <BarList
                  ariaLabel="How calls end"
                  max={ins.headline.connected}
                  rows={ins.endings.map((e) => ({
                    label: e.label,
                    value: e.count,
                    hint:
                      e.reason === "TIMEOUT"
                        ? "The call hit the agent's maximum length"
                        : e.reason === "USER_ENDS"
                        ? "The parent hung up"
                        : e.reason === "AGENT_ENDS"
                        ? "Anya said goodbye and ended the call"
                        : undefined,
                    display: (
                      <>
                        {e.count}
                        <span className="text-zinc-600 ml-1.5">{pct(e.count / (ins.headline.connected || 1))}</span>
                      </>
                    ),
                  }))}
                />
              </ChartBlock>
            </div>

            {/* 5. Familiarity + timing */}
            <div className="mt-14 grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-x-12 gap-y-14">
              <ChartBlock
                title="Does it get better with each call?"
                subtitle="Median turns on each parent's 1st, 2nd, 3rd… connected call."
                table={{
                  columns: ["Call", "Parents", "Median turns", "Median length", "Goal met"],
                  rows: ins.callNumber.map((p) => [
                    `Call ${p.n}`,
                    p.calls,
                    p.medianMessages ?? "—",
                    p.medianDurationSec !== null ? formatDuration(p.medianDurationSec) : "—",
                    pct(p.goalRate),
                  ]),
                }}
              >
                {ins.callNumber.length < 2 ? (
                  <p className="text-[13px] text-zinc-500">Needs parents with at least two calls.</p>
                ) : (
                  <PointLine
                    ariaLabel="Median turns by call number"
                    points={ins.callNumber.map((p) => ({ x: p.n, y: p.medianMessages || 0 }))}
                    xLabel={(x) => `Call ${x}`}
                    yLabel="turns"
                    tipFor={(i) => {
                      const p = ins.callNumber[i];
                      return (
                        <div className="min-w-[170px]">
                          <div className="text-zinc-100 mb-1">Call {p.n}</div>
                          <TipRow label="Parents" value={p.calls} />
                          <TipRow label="Median turns" value={p.medianMessages ?? "—"} />
                          <TipRow label="Median length" value={p.medianDurationSec !== null ? formatDuration(p.medianDurationSec) : "—"} />
                          <TipRow label="Goal met" value={pct(p.goalRate)} />
                        </div>
                      );
                    }}
                  />
                )}
              </ChartBlock>

              <ChartBlock
                title="When calls happen"
                subtitle="Calls by hour, India time."
                legend={[
                  { label: "Goal met", color: SERIES.primary },
                  { label: "Other", color: SERIES.muted },
                ]}
                table={{
                  columns: ["Hour", "Calls", "Goal met"],
                  rows: ins.hours.map((h) => [formatHour(h.hour), h.calls, h.goalMet]),
                }}
              >
                <StackedColumns
                  ariaLabel="Calls by hour of day"
                  height={180}
                  data={ins.hours.map((h) => ({ ...h, other: h.calls - h.goalMet }))}
                  segments={[
                    { key: "goalMet", label: "Goal met", color: SERIES.primary },
                    { key: "other", label: "Other", color: SERIES.muted },
                  ]}
                  xLabel={(d) => formatHour(d.hour).replace(" ", "")}
                  xTitle={(d) => `${formatHour(d.hour)}–${formatHour((d.hour + 1) % 24)}`}
                />
              </ChartBlock>
            </div>

            {/* 6. Where calls stall */}
            <section className="mt-14">
              <SectionTitle aside={<span className="text-[12px] text-zinc-600">Connected calls under {SHORT_CALL_SEC} s</span>}>
                Where calls stall
              </SectionTitle>
              {ins.short.length === 0 ? (
                <p className="text-[14px] text-zinc-400 border-t border-ay-line pt-4">No calls ended early in this period.</p>
              ) : (
                <ul className="divide-y divide-ay-line border-t border-ay-line">
                  {ins.short.map((c) => (
                    <li key={c.id} className="py-3.5 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-6 gap-y-1">
                      <div className="text-[13px]">
                        <span className="text-zinc-200">{c.parentName}</span>
                        <div className="text-[12px] text-zinc-500 tabular-nums mt-0.5">
                          {new Date(c.time).toLocaleDateString([], { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })},{" "}
                          {formatClock(c.time)} · {formatDuration(c.durationSec)}
                        </div>
                      </div>
                      <div className="text-[13px] leading-6">
                        {c.lastAgentLine ? (
                          <p className="text-zinc-300">
                            <span className="text-zinc-500">Anya&apos;s last words: </span>“{c.lastAgentLine}”
                          </p>
                        ) : (
                          <p className="text-zinc-500">Transcript not available.</p>
                        )}
                        <p className="text-[12px] text-zinc-500">
                          {c.parentSpoke === false || c.messages <= 1 ? "The parent never replied." : "The parent replied, then the call ended."}
                          {c.endReason === "USER_ENDS" ? " They hung up." : c.endReason === "AGENT_ENDS" ? " Anya ended it." : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 7. Quality */}
            <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-x-12 gap-y-14">
              <ChartBlock
                title="Evaluations"
                subtitle="Criteria Sarvam scores after each call."
                table={{
                  columns: ["Criterion", "Passed", "Scored"],
                  rows: ins.criteria.map((c) => [c.name, c.passed, c.evaluated]),
                }}
              >
                {ins.criteria.length === 0 ? (
                  <p className="text-[13px] text-zinc-500">No evaluated calls yet.</p>
                ) : (
                  <BarList
                    ariaLabel="Evaluation pass rates"
                    max={1}
                    rows={ins.criteria.map((c) => ({
                      label: c.name,
                      value: c.evaluated ? c.passed / c.evaluated : 0,
                      hint: `${c.passed} of ${c.evaluated} calls passed`,
                      display: pct(c.evaluated ? c.passed / c.evaluated : null),
                    }))}
                  />
                )}
              </ChartBlock>

              <ChartBlock
                title="How open parents are"
                subtitle="Sarvam's read of each connected call."
                table={{ columns: ["Signal", "Calls"], rows: ins.openness.map((o) => [humanize(o.key), o.count]) }}
              >
                {ins.openness.length === 0 ? (
                  <p className="text-[13px] text-zinc-500">No signal recorded yet.</p>
                ) : (
                  <BarList
                    ariaLabel="Openness"
                    max={ins.headline.connected}
                    rows={ins.openness.map((o) => ({ label: humanize(o.key), value: o.count }))}
                  />
                )}
              </ChartBlock>

              <ChartBlock
                title="Mood"
                subtitle="How parents sounded."
                table={{ columns: ["Mood", "Calls"], rows: ins.mood.map((o) => [humanize(o.key), o.count]) }}
              >
                {ins.mood.length === 0 ? (
                  <p className="text-[13px] text-zinc-500">No mood recorded yet.</p>
                ) : (
                  <BarList
                    ariaLabel="Mood"
                    max={ins.headline.connected}
                    rows={ins.mood.map((o) => ({ label: humanize(o.key), value: o.count }))}
                  />
                )}
              </ChartBlock>
            </div>

            {/* 8. Health topics + follow-ups */}
            <div className="mt-14 grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-x-12 gap-y-14">
              <ChartBlock
                title="What Anya found out"
                subtitle="Share of daily health logs where the topic got a real answer. Gaps show what she skips or parents avoid."
                table={{
                  columns: ["Topic", "Answered", "Logs"],
                  rows: ins.topics.map((t) => [t.label, t.covered, t.total]),
                }}
              >
                {ins.topics[0]?.total ? (
                  <BarList
                    ariaLabel="Health topics answered"
                    max={1}
                    rows={ins.topics.map((t) => ({
                      label: t.label,
                      value: t.total ? t.covered / t.total : 0,
                      hint: `${t.covered} of ${t.total} logs`,
                      display: pct(t.total ? t.covered / t.total : null),
                    }))}
                  />
                ) : (
                  <p className="text-[13px] text-zinc-500">No daily health logs in this period.</p>
                )}
              </ChartBlock>

              <section>
                <h2 className="text-[14px] font-medium text-zinc-100">Follow-ups</h2>
                <p className="text-[12.5px] text-zinc-500 mt-0.5">From Anya&apos;s review of each call.</p>
                <dl className="mt-4 grid grid-cols-3 gap-4">
                  {[
                    { label: "Raised", value: ins.followUps.raised },
                    { label: "Still open", value: ins.followUps.open },
                    { label: "Escalations", value: ins.followUps.escalations },
                  ].map((s) => (
                    <div key={s.label}>
                      <dt className="text-[12.5px] text-zinc-500">{s.label}</dt>
                      <dd className="mt-1 text-[24px] font-semibold text-white tabular-nums">{s.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-[12.5px] text-zinc-500">{ins.followUps.reviewed} calls reviewed.</p>
              </section>
            </div>

            {/* 9. Per parent */}
            <section className="mt-14">
              <SectionTitle>Per parent</SectionTitle>
              {/* Phone: one row per parent */}
              <ul className="sm:hidden border-t border-ay-line divide-y divide-ay-line">
                {ins.parents.map((p) => (
                  <li key={p.id} className="py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/parents?id=${p.id}`} className="text-[14px] text-zinc-100">
                        {p.name}
                      </Link>
                      <Sparkline values={p.messagesTrend} label={`Turns per call for ${p.name}: ${p.messagesTrend.join(", ")}`} />
                    </div>
                    <p className="mt-1 text-[12.5px] text-zinc-500 tabular-nums">
                      Goal met {p.goalMet}/{p.connected} · {p.calls} calls · typical{" "}
                      {p.medianTalkSec !== null ? formatDuration(p.medianTalkSec) : "—"}
                      {p.lastCallAt ? ` · ${formatRelative(new Date(p.lastCallAt).toISOString())}` : ""}
                    </p>
                    {p.flag && (
                      <p className="mt-1.5 inline-flex items-center gap-2 text-[12.5px] text-zinc-300">
                        <Dot tone={p.flag.tone} />
                        {p.flag.text}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block overflow-x-auto border-t border-ay-line">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead>
                    <tr className="text-left text-[12px] text-zinc-500">
                      <th className="font-normal py-3">Parent</th>
                      <th className="font-normal py-3 text-right">Calls</th>
                      <th className="font-normal py-3 text-right">Goal met</th>
                      <th className="font-normal py-3 text-right">Typical call</th>
                      <th className="font-normal py-3 pl-8">Turns per call</th>
                      <th className="font-normal py-3">Last call</th>
                      <th className="font-normal py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ay-line">
                    {ins.parents.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3">
                          <Link href={`/parents?id=${p.id}`} className="text-zinc-100 hover:underline underline-offset-4 decoration-zinc-600">
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-3 text-right tabular-nums text-zinc-300">{p.calls}</td>
                        <td className="py-3 text-right tabular-nums text-zinc-300">
                          {p.goalMet}/{p.connected}
                          <span className="text-zinc-600 ml-1.5">{pct(p.goalRate)}</span>
                        </td>
                        <td className="py-3 text-right tabular-nums text-zinc-300">
                          {p.medianTalkSec !== null ? formatDuration(p.medianTalkSec) : "—"}
                        </td>
                        <td className="py-3 pl-8">
                          <Sparkline values={p.messagesTrend} label={`Turns per call for ${p.name}: ${p.messagesTrend.join(", ")}`} />
                        </td>
                        <td className="py-3 text-zinc-500">{p.lastCallAt ? formatRelative(new Date(p.lastCallAt).toISOString()) : "—"}</td>
                        <td className="py-3 text-right">
                          {p.flag && (
                            <span className="inline-flex items-center gap-2 text-[12.5px] text-zinc-300">
                              <Dot tone={p.flag.tone} />
                              {p.flag.text}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 10. Speed + cost */}
            <section className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-8 border-t border-ay-line pt-6">
              <Stat
                label="Anya's reply time"
                value={ins.speed.agentMedian !== null ? `${ins.speed.agentMedian.toFixed(2)} s` : "—"}
                detail={ins.speed.agentP90 !== null ? `Slowest 10%: ${ins.speed.agentP90.toFixed(2)} s` : "Not measured yet"}
              />
              <Stat
                label="Parent's reply time"
                value={ins.speed.parentMedian !== null ? `${ins.speed.parentMedian.toFixed(1)} s` : "—"}
                detail="How long parents take to answer"
              />
              <Stat
                label="Minutes talked"
                value={Math.round(ins.cost.minutes).toString()}
                detail={`About ₹${Math.round(ins.cost.rupees)} in usage and telephony`}
              />
              <Stat
                label="Cost per useful call"
                value={ins.cost.perGoalMet !== null ? `₹${ins.cost.perGoalMet.toFixed(0)}` : "—"}
                detail="Per call that met the goal"
              />
            </section>

            {/* Footnote */}
            <footer className="mt-14 pt-5 border-t border-ay-line text-[12.5px] text-zinc-500 leading-6">
              <details>
                <summary className="cursor-pointer hover:text-zinc-300 w-fit">
                  {ledger!.excluded.total} test {ledger!.excluded.total === 1 ? "call" : "calls"} excluded from every number
                </summary>
                <ul className="mt-2 space-y-0.5">
                  {ledger!.excluded.byReason.map((r) => (
                    <li key={r.reason} className="flex gap-3">
                      <span className="tabular-nums text-zinc-300 w-6 text-right">{r.count}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              </details>
              <p className="mt-2">
                Sarvam call analytics joined with Anya&apos;s reviews in Supabase · updated{" "}
                {formatRelative(new Date(query.dataUpdatedAt).toISOString())}
              </p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
