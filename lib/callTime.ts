/**
 * A parent's best call time and sleep time, as "HH:MM" India time. They are
 * shown on the parent page and go into the onboarding context; they do not
 * limit when a parent can be called.
 */

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
