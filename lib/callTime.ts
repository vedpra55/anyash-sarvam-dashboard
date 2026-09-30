/**
 * Bedtime guard for outbound calls. Times are "HH:MM" in India time.
 *
 * latest call time = sleep_time - 60 min, or preferred_call_time + 90 min when
 * sleep_time is empty. With neither set there is no limit.
 *
 * The calling day starts at 05:00 IST: anything between midnight and 05:00
 * counts as late the previous night, so a call at 01:00 is refused and a
 * sleep time of 00:30 means "latest 23:30".
 */

const IST_OFFSET_MIN = 330;
const DAY_START_MIN = 5 * 60;
const MIN_PER_DAY = 24 * 60;

/** Parses "21:30", "9:30", "9:30 PM" or "21:30:00" into minutes after midnight. */
export function parseClock(value?: string | null): number | null {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?$/i);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[3]?.toLowerCase().replace(/\./g, "");
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "pm" && hours !== 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Normalises a user-entered time to "HH:MM", or null if empty/invalid. */
export function normalizeClock(value?: string | null): string | null {
  const minutes = parseClock(value);
  return minutes === null ? null : formatClock24(minutes);
}

function formatClock24(minutes: number): string {
  const m = ((minutes % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "21:30" -> "9:30 PM". */
export function formatClock(minutes: number): string {
  const m = ((minutes % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Minutes on the calling-day scale, where 00:00–04:59 come after 23:59. */
function onCallingDay(minutes: number): number {
  return minutes < DAY_START_MIN ? minutes + MIN_PER_DAY : minutes;
}

export interface LatestCallTime {
  /** Minutes on the calling-day scale (may exceed 1440). */
  minutes: number;
  /** "HH:MM". */
  clock: string;
  basis: "sleep_time" | "preferred_call_time";
}

export function latestCallTime(
  sleepTime?: string | null,
  preferredCallTime?: string | null,
): LatestCallTime | null {
  const sleep = parseClock(sleepTime);
  if (sleep !== null) {
    const minutes = onCallingDay(sleep) - 60;
    return { minutes, clock: formatClock24(minutes), basis: "sleep_time" };
  }
  const preferred = parseClock(preferredCallTime);
  if (preferred !== null) {
    const minutes = onCallingDay(preferred) + 90;
    return { minutes, clock: formatClock24(minutes), basis: "preferred_call_time" };
  }
  return null;
}

/** Current India time as minutes after midnight. */
export function istMinutes(now: Date = new Date()): number {
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utc + IST_OFFSET_MIN) % MIN_PER_DAY;
}

export type CallTimeCheck =
  | { allowed: true; latest: LatestCallTime | null }
  | { allowed: false; latest: LatestCallTime; reason: string };

export function checkCallTime(
  profile: { parent_name?: string | null; sleep_time?: string | null; preferred_call_time?: string | null },
  now: Date = new Date(),
): CallTimeCheck {
  const latest = latestCallTime(profile.sleep_time, profile.preferred_call_time);
  if (!latest) return { allowed: true, latest: null };

  const nowMin = istMinutes(now);
  if (onCallingDay(nowMin) <= latest.minutes) return { allowed: true, latest };

  const name = profile.parent_name || "This parent";
  const basis =
    latest.basis === "sleep_time"
      ? `an hour before their ${formatClock(parseClock(profile.sleep_time)!)} bedtime`
      : `90 minutes after their ${formatClock(parseClock(profile.preferred_call_time)!)} call time`;
  return {
    allowed: false,
    latest,
    reason: `It's ${formatClock(nowMin)} in India. ${name}'s latest call time is ${formatClock(latest.minutes)} (${basis}), so the call wasn't placed.`,
  };
}

const CALL_TIME_FIELDS = ["preferred_call_time", "sleep_time"] as const;

/**
 * Reads preferred_call_time / sleep_time from a request body. Only fields that
 * are present are returned; an empty string clears the field.
 */
export function readCallTimes(
  body: Record<string, any>,
): { values: Partial<Record<(typeof CALL_TIME_FIELDS)[number], string | null>> } | { error: string } {
  const values: Partial<Record<(typeof CALL_TIME_FIELDS)[number], string | null>> = {};
  for (const field of CALL_TIME_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || String(raw).trim() === "") {
      values[field] = null;
      continue;
    }
    const clock = normalizeClock(String(raw));
    if (!clock) return { error: `${field} must be a time like 19:30` };
    values[field] = clock;
  }
  return { values };
}
