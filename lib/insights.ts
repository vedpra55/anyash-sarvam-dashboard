/**
 * Insights engine: turns the trial call ledger into metrics, chart series and
 * plain-language findings. Pure functions only, so it runs in the browser (for
 * instant range switching) and in unit tests.
 */

import { TRIAL_START_MS } from "./trial";

/* ------------------------------------------------------------------ */
/* Ledger types (built by /api/insights)                               */
/* ------------------------------------------------------------------ */

export type GoalStatus = "passed" | "failed" | "not_evaluated";

export interface LedgerCall {
  id: string;
  /** Epoch ms of the attempt. */
  time: number;
  parentId: string | null;
  parentName: string;
  status: string;
  connected: boolean;
  durationSec: number;
  messages: number;
  endReason: string | null;
  /** Seconds; null when Sarvam didn't measure it. */
  agentLatency: number | null;
  parentLatency: number | null;
  goal: GoalStatus;
  criteria: { name: string; status: GoalStatus }[];
  outcome: string | null;
  mood: string | null;
  openness: string | null;
  followUp: boolean;
  healthCaptured: boolean;
  callNumber: number | null;
  decision: string | null;
  /** For calls that ended early: the last thing Anya said, and whether the parent spoke. */
  lastAgentLine?: string | null;
  parentSpoke?: boolean | null;
}

export interface LedgerLog {
  parentId: string;
  date: string;
  sleep: boolean;
  meals: boolean;
  medicines: boolean;
  pain: boolean;
  mood: boolean;
  vitals: boolean;
}

export interface LedgerFollowUp {
  decision: string | null;
  urgency: string | null;
  completed: boolean;
  createdAt: number;
}

export interface LedgerParent {
  id: string;
  name: string;
}

export interface Ledger {
  trialStart: string;
  generatedAt: string;
  calls: LedgerCall[];
  parents: LedgerParent[];
  logs: LedgerLog[];
  followUps: LedgerFollowUp[];
  excluded: { total: number; byReason: { reason: string; label: string; count: number }[] };
}

export type RangeId = "7d" | "30d" | "trial";

/* ------------------------------------------------------------------ */
/* Time helpers (India time)                                           */
/* ------------------------------------------------------------------ */

const IST_OFFSET_MS = 5.5 * 3600_000;
const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" of the day in India. */
export function istDay(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Hour of day (0–23) in India. */
export function istHour(ms: number): number {
  return new Date(ms + IST_OFFSET_MS).getUTCHours();
}

/** Epoch ms of 00:00 IST on the given IST day. */
function istDayStart(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS;
}

function addDays(day: string, n: number): string {
  return istDay(istDayStart(day) + n * DAY_MS);
}

/** Minutes since 4 AM India time, so late-night calls sort after the evening ones. */
function eveningMinute(ms: number): number {
  const d = new Date(ms + IST_OFFSET_MS);
  return (d.getUTCHours() * 60 + d.getUTCMinutes() - 240 + 1440) % 1440;
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function formatHour(h: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${suffix}`;
}

export function formatClock(ms: number): string {
  const d = new Date(ms + IST_OFFSET_MS);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/* ------------------------------------------------------------------ */
/* Stats helpers                                                       */
/* ------------------------------------------------------------------ */

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function percentile(values: number[], p: number): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1));
  return v[idx];
}

function rate(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

export interface Window {
  from: string;
  to: string;
  days: string[];
  prev: { from: string; to: string } | null;
}

export function windowFor(range: RangeId, now: number): Window {
  const today = istDay(now);
  const trialDay = istDay(TRIAL_START_MS);
  const span = range === "7d" ? 7 : range === "30d" ? 30 : null;
  let from = span ? addDays(today, -(span - 1)) : trialDay;
  if (from < trialDay) from = trialDay;
  const days = daysBetween(from, today);
  let prev: Window["prev"] = null;
  if (span) {
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(from, -span);
    // Only compare when the previous period is fully inside the trial.
    if (prevFrom >= trialDay) prev = { from: prevFrom, to: prevTo };
  }
  return { from, to: today, days, prev };
}

function inDays(call: LedgerCall, from: string, to: string) {
  const d = istDay(call.time);
  return d >= from && d <= to;
}

/* ------------------------------------------------------------------ */
/* Headline metrics                                                    */
/* ------------------------------------------------------------------ */

export interface Headline {
  calls: number;
  connected: number;
  goalMet: number;
  connectRate: number | null;
  goalRate: number | null;
  medianTalkSec: number | null;
  /** Share of parent-days (completed days only) with a call that met the goal. */
  coverage: number | null;
  coverageDays: number;
}

function firstCallDayByParent(calls: LedgerCall[]): Map<string, string> {
  const first = new Map<string, string>();
  for (const c of calls) {
    if (!c.parentId) continue;
    const d = istDay(c.time);
    const cur = first.get(c.parentId);
    if (!cur || d < cur) first.set(c.parentId, d);
  }
  return first;
}

export function headline(allCalls: LedgerCall[], from: string, to: string, today: string): Headline {
  const calls = allCalls.filter((c) => inDays(c, from, to));
  const connected = calls.filter((c) => c.connected);
  const goalMet = connected.filter((c) => c.goal === "passed");

  // Coverage over completed days: a parent counts from the day of their first call.
  const first = firstCallDayByParent(allCalls);
  const lastCompleted = to >= today ? addDays(today, -1) : to;
  let eligible = 0;
  let covered = 0;
  let coverageDays = 0;
  if (lastCompleted >= from) {
    const metDays = new Set(goalMet.map((c) => `${c.parentId}|${istDay(c.time)}`));
    for (const day of daysBetween(from, lastCompleted)) {
      let any = false;
      for (const [pid, firstDay] of Array.from(first.entries())) {
        if (firstDay > day) continue;
        eligible++;
        any = true;
        if (metDays.has(`${pid}|${day}`)) covered++;
      }
      if (any) coverageDays++;
    }
  }

  return {
    calls: calls.length,
    connected: connected.length,
    goalMet: goalMet.length,
    connectRate: rate(connected.length, calls.length),
    goalRate: rate(goalMet.length, connected.length),
    medianTalkSec: median(connected.map((c) => c.durationSec)),
    coverage: rate(covered, eligible),
    coverageDays,
  };
}

/* ------------------------------------------------------------------ */
/* Series                                                              */
/* ------------------------------------------------------------------ */

export interface DayPoint {
  day: string;
  goalMet: number;
  talked: number;
  notConnected: number;
}

export function dailySeries(calls: LedgerCall[], days: string[]): DayPoint[] {
  const map = new Map<string, DayPoint>(days.map((d) => [d, { day: d, goalMet: 0, talked: 0, notConnected: 0 }]));
  for (const c of calls) {
    const p = map.get(istDay(c.time));
    if (!p) continue;
    if (!c.connected) p.notConnected++;
    else if (c.goal === "passed") p.goalMet++;
    else p.talked++;
  }
  return days.map((d) => map.get(d)!);
}

export interface FunnelStep {
  label: string;
  count: number;
  hint: string;
}

/** Sarvam counts a connected call as a real conversation above 3 turns. */
export const ENGAGED_MIN_MESSAGES = 4;

export function funnel(calls: LedgerCall[]): FunnelStep[] {
  const connected = calls.filter((c) => c.connected);
  const engaged = connected.filter((c) => c.messages >= ENGAGED_MIN_MESSAGES);
  const goal = connected.filter((c) => c.goal === "passed");
  const captured = goal.filter((c) => c.healthCaptured);
  return [
    { label: "Dialed", count: calls.length, hint: "Every call attempt" },
    { label: "Connected", count: connected.length, hint: "The parent picked up" },
    { label: "Conversation", count: engaged.length, hint: "More than 3 turns" },
    { label: "Goal met", count: goal.length, hint: "Sarvam's Call Goal passed" },
    { label: "Health captured", count: captured.length, hint: "A health update was recorded" },
  ];
}

export const END_REASON_LABEL: Record<string, string> = {
  AGENT_ENDS: "Anya wrapped up",
  USER_ENDS: "Parent hung up",
  TIMEOUT: "Hit the time limit",
};

export function endings(calls: LedgerCall[]): { reason: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of calls) {
    if (!c.connected) continue;
    const r = c.endReason || "OTHER";
    counts.set(r, (counts.get(r) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, label: END_REASON_LABEL[reason] || "Other", count }))
    .sort((a, b) => b.count - a.count);
}

export interface HourPoint {
  hour: number;
  calls: number;
  goalMet: number;
}

export function byHour(calls: LedgerCall[]): HourPoint[] {
  const map = new Map<number, HourPoint>();
  for (const c of calls) {
    const h = istHour(c.time);
    const p = map.get(h) || { hour: h, calls: 0, goalMet: 0 };
    p.calls++;
    if (c.connected && c.goal === "passed") p.goalMet++;
    map.set(h, p);
  }
  return Array.from(map.values()).sort((a, b) => a.hour - b.hour);
}

export interface CallNumberPoint {
  n: number;
  calls: number;
  medianMessages: number | null;
  medianDurationSec: number | null;
  goalRate: number | null;
}

/** How conversations change from a parent's 1st connected call to their 2nd, 3rd… */
export function byCallNumber(calls: LedgerCall[]): CallNumberPoint[] {
  const perParent = new Map<string, LedgerCall[]>();
  for (const c of calls) {
    if (!c.connected || !c.parentId) continue;
    perParent.set(c.parentId, [...(perParent.get(c.parentId) || []), c]);
  }
  const byN = new Map<number, LedgerCall[]>();
  for (const list of Array.from(perParent.values())) {
    list.sort((a, b) => a.time - b.time).forEach((c, i) => byN.set(i + 1, [...(byN.get(i + 1) || []), c]));
  }
  return Array.from(byN.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([n, list]) => ({
      n,
      calls: list.length,
      medianMessages: median(list.map((c) => c.messages)),
      medianDurationSec: median(list.map((c) => c.durationSec)),
      goalRate: rate(list.filter((c) => c.goal === "passed").length, list.length),
    }));
}

export function distribution(values: (string | null)[]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function criteriaPassRates(calls: LedgerCall[]): { name: string; passed: number; evaluated: number }[] {
  const map = new Map<string, { passed: number; evaluated: number }>();
  for (const c of calls) {
    if (!c.connected) continue;
    for (const cr of c.criteria) {
      if (cr.status === "not_evaluated") continue;
      const m = map.get(cr.name) || { passed: 0, evaluated: 0 };
      m.evaluated++;
      if (cr.status === "passed") m.passed++;
      map.set(cr.name, m);
    }
  }
  return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
}

export const TOPICS: { key: keyof Omit<LedgerLog, "parentId" | "date">; label: string }[] = [
  { key: "sleep", label: "Sleep" },
  { key: "meals", label: "Meals" },
  { key: "pain", label: "Pain & mobility" },
  { key: "mood", label: "Mood & energy" },
  { key: "medicines", label: "Medicines" },
  { key: "vitals", label: "BP / sugar" },
];

export function topicCoverage(logs: LedgerLog[], from: string, to: string) {
  const inRange = logs.filter((l) => l.date >= from && l.date <= to);
  return TOPICS.map((t) => ({
    key: t.key,
    label: t.label,
    covered: inRange.filter((l) => l[t.key]).length,
    total: inRange.length,
  }));
}

export interface SpeedStats {
  agentMedian: number | null;
  agentP90: number | null;
  parentMedian: number | null;
  measuredCalls: number;
}

export function speed(calls: LedgerCall[]): SpeedStats {
  const agent = calls.map((c) => c.agentLatency).filter((v): v is number => v !== null && v > 0);
  const parent = calls.map((c) => c.parentLatency).filter((v): v is number => v !== null && v > 0);
  return {
    agentMedian: median(agent),
    agentP90: percentile(agent, 90),
    parentMedian: median(parent),
    measuredCalls: agent.length,
  };
}

/** ₹ per started minute (usage) + ₹ per started 30 s (telephony), as in lib/analytics.ts. */
export function cost(calls: LedgerCall[]) {
  let usage = 0;
  let telephony = 0;
  let seconds = 0;
  for (const c of calls) {
    if (!c.connected || c.durationSec <= 0) continue;
    seconds += c.durationSec;
    usage += Math.max(1, Math.ceil(c.durationSec / 60)) * 4.5;
    telephony += Math.max(1, Math.ceil(c.durationSec / 30)) * 0.4;
  }
  const goalMet = calls.filter((c) => c.connected && c.goal === "passed").length;
  const total = usage + telephony;
  return { minutes: seconds / 60, rupees: total, perGoalMet: goalMet ? total / goalMet : null };
}

export const SHORT_CALL_SEC = 30;

export function shortCalls(calls: LedgerCall[]) {
  return calls
    .filter((c) => c.connected && c.durationSec < SHORT_CALL_SEC)
    .sort((a, b) => b.time - a.time);
}

/* ------------------------------------------------------------------ */
/* Per parent                                                          */
/* ------------------------------------------------------------------ */

export interface ParentInsight {
  id: string;
  name: string;
  calls: number;
  connected: number;
  goalMet: number;
  goalRate: number | null;
  medianTalkSec: number | null;
  /** Messages per connected call, oldest first. */
  messagesTrend: number[];
  lastCallAt: number | null;
  flag: { tone: "watch" | "good"; text: string } | null;
}

export function perParent(calls: LedgerCall[], parents: LedgerParent[]): ParentInsight[] {
  return parents
    .map((p) => {
      const mine = calls.filter((c) => c.parentId === p.id).sort((a, b) => a.time - b.time);
      const connected = mine.filter((c) => c.connected);
      const goalMet = connected.filter((c) => c.goal === "passed");
      const trend = connected.map((c) => c.messages);
      let flag: ParentInsight["flag"] = null;
      const lastThree = trend.slice(-3);
      if (lastThree.length === 3 && lastThree[0] > lastThree[1] && lastThree[1] > lastThree[2]) {
        flag = { tone: "watch", text: "Getting shorter" };
      } else if (connected.length >= 3 && goalMet.length / connected.length <= 0.5) {
        flag = { tone: "watch", text: "Often no real conversation" };
      } else if (connected.length >= 3 && goalMet.length === connected.length) {
        flag = { tone: "good", text: "Every call met the goal" };
      }
      return {
        id: p.id,
        name: p.name,
        calls: mine.length,
        connected: connected.length,
        goalMet: goalMet.length,
        goalRate: rate(goalMet.length, connected.length),
        medianTalkSec: median(connected.map((c) => c.durationSec)),
        messagesTrend: trend,
        lastCallAt: mine.length ? mine[mine.length - 1].time : null,
        flag,
      };
    })
    .filter((p) => p.calls > 0)
    .sort((a, b) => (a.goalRate ?? 2) - (b.goalRate ?? 2) || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/* Findings                                                            */
/* ------------------------------------------------------------------ */

export interface Finding {
  id: string;
  tone: "watch" | "good" | "neutral";
  title: string;
  detail: string;
}

/** Findings need at least this many connected calls to say anything. */
export const MIN_CALLS_FOR_FINDINGS = 5;

function pct(n: number | null) {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

export function findings(calls: LedgerCall[], parents: LedgerParent[]): Finding[] {
  const connected = calls.filter((c) => c.connected);
  if (connected.length < MIN_CALLS_FOR_FINDINGS) return [];
  const out: Finding[] = [];

  // 1. Conversations cut off by the time limit.
  const timeouts = connected.filter((c) => c.endReason === "TIMEOUT");
  if (timeouts.length > 0) {
    const secs = median(timeouts.map((c) => c.durationSec)) || 0;
    out.push({
      id: "timeouts",
      tone: "watch",
      title: `${timeouts.length} ${timeouts.length === 1 ? "call was" : "calls were"} cut off by the time limit`,
      detail: `They stopped at about ${Math.round(secs / 60)} min while the conversation was still going${
        timeouts.every((c) => c.goal === "passed") ? ", and all of them were going well" : ""
      }. Raise the agent's time limit or have Anya start wrapping up earlier.`,
    });
  }

  // 2. Short calls and when they happen.
  const short = connected.filter((c) => c.durationSec < SHORT_CALL_SEC);
  if (short.length >= 2) {
    const late = short.filter((c) => istHour(c.time) >= 23 || istHour(c.time) < 5);
    const silent = short.filter((c) => c.parentSpoke === false || c.messages <= 1);
    const parts: string[] = [];
    if (late.length / short.length >= 0.6) parts.push(`${late.length} of ${short.length} started after 11 PM`);
    if (silent.length) parts.push(`in ${silent.length} the parent didn't reply to the greeting`);
    out.push({
      id: "short-calls",
      tone: "watch",
      title: `${short.length} of ${connected.length} calls ended within ${SHORT_CALL_SEC} seconds`,
      detail: parts.length
        ? `${parts.join("; ")}. Calling earlier in the evening may help.`
        : "Open them under “Where calls stall” to see the last thing Anya said.",
    });
  }

  // 3. The parent who struggles most / does best.
  const pp = perParent(calls, parents).filter((p) => p.connected >= 3);
  const weakest = pp.find((p) => (p.goalRate ?? 1) <= 0.5);
  if (weakest) {
    out.push({
      id: `parent-${weakest.id}`,
      tone: "watch",
      title: `${weakest.name}: a real conversation on ${weakest.goalMet} of ${weakest.connected} calls`,
      detail: "The rest ended before any health update. Check the timing and the opening of these calls.",
    });
  }
  const best = pp.filter((p) => p.goalMet === p.connected);
  if (best.length) {
    out.push({
      id: "best-parents",
      tone: "good",
      title: `${best.map((p) => p.name).join(" and ")} met the goal on every call`,
      detail: `${best.reduce((n, p) => n + p.connected, 0)} calls, median ${Math.round(
        median(best.flatMap((p) => calls.filter((c) => c.parentId === p.id && c.connected).map((c) => c.durationSec))) || 0
      )} s each.`,
    });
  }

  // 4. Does engagement grow with familiarity?
  const curve = byCallNumber(calls);
  const firstN = curve.find((p) => p.n === 1);
  const later = curve.filter((p) => p.n >= 2 && p.calls >= 2);
  if (firstN?.medianMessages && later.length) {
    const laterMedian = median(later.map((p) => p.medianMessages || 0)) || 0;
    const diff = laterMedian - firstN.medianMessages;
    if (Math.abs(diff) >= 3) {
      out.push({
        id: "familiarity",
        tone: diff > 0 ? "good" : "watch",
        title:
          diff > 0
            ? `Conversations grow after the first call: ${Math.round(firstN.medianMessages)} → ${Math.round(laterMedian)} turns`
            : `Conversations shrink after the first call: ${Math.round(firstN.medianMessages)} → ${Math.round(laterMedian)} turns`,
        detail: diff > 0 ? "Parents open up once they know Anya." : "Parents may be losing interest; vary the questions.",
      });
    }
  }

  // 5. Call timing.
  if (connected.length >= MIN_CALLS_FOR_FINDINGS) {
    const sorted = [...connected].sort((a, b) => eveningMinute(a.time) - eveningMinute(b.time));
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    if (eveningMinute(latest.time) - eveningMinute(earliest.time) <= 4 * 60) {
      out.push({
        id: "timing",
        tone: "neutral",
        title: `Every call went out between ${formatClock(earliest.time)} and ${formatClock(latest.time)}`,
        detail: "No calls at other times of day yet, so there's nothing to compare. Try an earlier slot for a few days.",
      });
    }
  }

  // 6. Speed.
  const sp = speed(connected);
  // Only worth a finding when it's slow; otherwise it lives in the Speed section.
  if (sp.agentMedian !== null && sp.agentMedian > 1 && sp.measuredCalls >= MIN_CALLS_FOR_FINDINGS) {
    out.push({
      id: "speed",
      tone: "watch",
      title: `Anya takes ${sp.agentMedian.toFixed(2)} s to reply`,
      detail: `Slowest 10% of calls: ${sp.agentP90?.toFixed(2)} s. Parents take ${sp.parentMedian?.toFixed(1)} s to answer.`,
    });
  }

  const order = { watch: 0, good: 1, neutral: 2 } as const;
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 6);
}

/* ------------------------------------------------------------------ */
/* Everything for one range                                            */
/* ------------------------------------------------------------------ */

export function computeInsights(ledger: Ledger, range: RangeId, now: number) {
  const win = windowFor(range, now);
  const today = istDay(now);
  const calls = ledger.calls.filter((c) => inDays(c, win.from, win.to));
  const connected = calls.filter((c) => c.connected);
  const followUps = ledger.followUps.filter(
    (f) => istDay(f.createdAt) >= win.from && istDay(f.createdAt) <= win.to
  );

  return {
    window: win,
    headline: headline(ledger.calls, win.from, win.to, today),
    previous: win.prev ? headline(ledger.calls, win.prev.from, win.prev.to, today) : null,
    daily: dailySeries(calls, win.days),
    funnel: funnel(calls),
    endings: endings(calls),
    hours: byHour(calls),
    callNumber: byCallNumber(calls),
    openness: distribution(connected.map((c) => c.openness)),
    mood: distribution(connected.map((c) => c.mood)),
    criteria: criteriaPassRates(calls),
    topics: topicCoverage(ledger.logs, win.from, win.to),
    speed: speed(connected),
    cost: cost(calls),
    short: shortCalls(calls),
    parents: perParent(calls, ledger.parents),
    followUps: {
      raised: followUps.filter((f) => f.decision && f.decision !== "NORMAL").length,
      open: followUps.filter((f) => f.decision && f.decision !== "NORMAL" && !f.completed).length,
      escalations: followUps.filter((f) => f.decision === "ESCALATION" || f.urgency === "urgent").length,
      reviewed: followUps.length,
    },
    findings: findings(calls, ledger.parents),
    sample: { calls: calls.length, connected: connected.length },
  };
}

export type Insights = ReturnType<typeof computeInsights>;
export { pct };
