/**
 * The gap between a parent's last call and today, sent to the agent as
 * `last_call_date` and `days_since_last_call` (prompt v33).
 *
 * Days are India days. The gap counts only the whole days in between: neither
 * the last call's day nor today is counted. Last call on the 6th, today the
 * 9th: the 7th and 8th, so 2. A call yesterday or earlier today gives 0.
 */

const IST_OFFSET_MS = 5.5 * 3600_000;
const DAY_MS = 24 * 3600_000;

/** "YYYY-MM-DD" in India time. */
export function istDate(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Whole days strictly between two "YYYY-MM-DD" dates, never below 0. */
export function daysBetween(lastCallDate: string, today: string): number | null {
  if (!isDate(lastCallDate) || !isDate(today)) return null;
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastCallDate}T00:00:00Z`)) / DAY_MS);
  return Math.max(0, diff - 1);
}

/** The last call date that gives this many days in between, counted back from today. */
export function dateForGap(days: number, today: string): string | null {
  if (!Number.isInteger(days) || days < 0 || !isDate(today)) return null;
  return new Date(Date.parse(`${today}T00:00:00Z`) - (days + 1) * DAY_MS).toISOString().slice(0, 10);
}

/** A call the parent actually picked up and spoke on. */
function isConnected(call: { call_status?: string; duration_seconds?: number }): boolean {
  const status = (call.call_status || "").toLowerCase();
  return (status === "connected" || status === "completed") && (call.duration_seconds ?? 1) > 0;
}

/** India date of the most recent connected call, or null if there is none. */
export function lastCallDateOf(
  calls: { created_at?: string; call_status?: string; duration_seconds?: number }[] | undefined,
): string | null {
  let latest = -Infinity;
  for (const call of calls || []) {
    if (!isConnected(call)) continue;
    const t = Date.parse(call.created_at || "");
    if (!Number.isNaN(t) && t > latest) latest = t;
  }
  return latest === -Infinity ? null : istDate(latest);
}

export interface CallGap {
  /** "YYYY-MM-DD", or "" when there has been no call yet. */
  last_call_date: string;
  /** Whole days in between, as a string, or "" when there has been no call yet. */
  days_since_last_call: string;
}

/**
 * The two agent variables. Values typed in the call modal win; otherwise they
 * come from the parent's calls. A typed date alone sets the days from it.
 */
export function resolveCallGap(
  input: { last_call_date?: unknown; days_since_last_call?: unknown },
  calls: Parameters<typeof lastCallDateOf>[0],
  now: number = Date.now(),
): CallGap {
  const today = istDate(now);
  const typedDate = typeof input.last_call_date === "string" && isDate(input.last_call_date.trim())
    ? input.last_call_date.trim()
    : null;
  const rawDays = input.days_since_last_call;
  const typedDays =
    rawDays !== undefined && rawDays !== null && String(rawDays).trim() !== "" && Number.isInteger(Number(rawDays)) && Number(rawDays) >= 0
      ? Number(rawDays)
      : null;

  const date = typedDate ?? (typedDays !== null ? dateForGap(typedDays, today) : lastCallDateOf(calls));
  if (!date) return { last_call_date: "", days_since_last_call: "" };
  const days = typedDays ?? daysBetween(date, today);
  return { last_call_date: date, days_since_last_call: days === null ? "" : String(days) };
}
