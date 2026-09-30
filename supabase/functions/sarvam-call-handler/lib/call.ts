/**
 * Pure helpers for the post-call path: transcript normalisation, duration,
 * the real-call rule and India-time dates. No I/O, so they are unit tested.
 */

export interface TranscriptTurn {
  role: "agent" | "user";
  text: string;
  /** Seconds or ISO time, when Sarvam sends one. */
  timestamp?: string | number;
}

/** A call counts as a real conversation only if all three hold. */
export const MIN_REAL_CALL_SECONDS = 45;
export const MIN_PARENT_TURNS = 3;
export const NON_CONVERSATION_OUTCOMES = new Set([
  "no_conversation",
  "busy_or_refused",
  "wrong_person",
  "test_call",
]);

/**
 * Where Sarvam may put the call length, in the order they are trusted.
 * `call_duration_seconds` is the on_end tool's system variable; the others
 * are older webhook and API shapes.
 */
export const DURATION_FIELDS = [
  "call_duration_seconds",
  "duration_in_seconds",
  "duration",
  "call_duration",
  "interaction_duration",
] as const;

const TIMESTAMP_FIELDS = ["timestamp", "start_time", "time", "created_at", "start"] as const;

function toRole(raw: unknown): "agent" | "user" {
  const role = String(raw || "").toLowerCase();
  return role === "user" || role === "human" || role === "customer" ? "user" : "agent";
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

/** Parses "user: ...\nagent: ..." text, the shape a system variable may arrive in. */
function parseTextTranscript(text: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(user|agent|assistant|bot|human)\s*[:\-]\s*(.*)$/i);
    if (m) turns.push({ role: toRole(m[1]), text: m[2].trim() });
    else if (line.trim() && turns.length > 0) turns[turns.length - 1].text += ` ${line.trim()}`;
  }
  return turns;
}

/**
 * The on_end system variable wraps the turns:
 * { app_id, app_version, interaction_transcript: [{ role, en_text, indic_text }] }.
 */
function unwrapTurns(value: unknown): unknown {
  let current = parseMaybeJson(value);
  for (let depth = 0; depth < 3 && current && typeof current === "object" && !Array.isArray(current); depth++) {
    const obj = current as Record<string, unknown>;
    current = parseMaybeJson(obj.interaction_transcript ?? obj.transcript ?? obj.turns ?? obj.messages);
  }
  return current;
}

/** Accepts every transcript shape seen from Sarvam and returns clean turns. */
export function normalizeTranscript(body: Record<string, any>): TranscriptTurn[] {
  const source = unwrapTurns(body.interaction_transcript ?? body.transcript ?? body.messages);

  if (typeof source === "string") return parseTextTranscript(source);
  if (!Array.isArray(source)) return [];

  return source
    .map((t: any): TranscriptTurn => {
      const turn: TranscriptTurn = {
        role: toRole(t?.role),
        text: String(t?.en_text || t?.text || t?.content || t?.indic_text || "").trim(),
      };
      const ts = TIMESTAMP_FIELDS.map((f) => t?.[f]).find((v) => v !== undefined && v !== null && v !== "");
      if (ts !== undefined) turn.timestamp = ts;
      return turn;
    })
    .filter((t) => t.text);
}

export function countParentTurns(transcript: TranscriptTurn[]): number {
  return transcript.filter((t) => t.role === "user" && t.text.trim()).length;
}

function toSeconds(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function toEpochMs(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return asNumber > 1e12 ? asNumber : asNumber * 1000;
  // Only differences between two times are used, so a zoneless value is read
  // as UTC consistently (Sarvam's runtime times are India time without a zone).
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(String(value)) ? String(value) : `${value}Z`;
  const ms = Date.parse(iso.replace(" ", "T"));
  return Number.isFinite(ms) ? ms : null;
}

function spanSeconds(start: unknown, end: unknown): number | null {
  const a = toEpochMs(start);
  const b = toEpochMs(end);
  if (a === null || b === null || b <= a) return null;
  return Math.round((b - a) / 1000);
}

export interface ResolvedDuration {
  seconds: number;
  /** The field the value came from, or "none". Logged for every call. */
  source: string;
}

/**
 * Reads the call length from every field Sarvam may send, then falls back to
 * the interaction start/end times, then to the first and last transcript
 * timestamps.
 */
export function resolveDuration(body: Record<string, any>, transcript: TranscriptTurn[]): ResolvedDuration {
  for (const field of DURATION_FIELDS) {
    const seconds = toSeconds(body[field]);
    if (seconds !== null) return { seconds, source: field };
  }

  const fromInteraction = spanSeconds(body.interaction_start_time, body.interaction_end_time);
  if (fromInteraction !== null) {
    return { seconds: fromInteraction, source: "interaction_start_time..interaction_end_time" };
  }

  const stamped = transcript.filter((t) => t.timestamp !== undefined);
  if (stamped.length >= 2) {
    const first = stamped[0].timestamp;
    const last = stamped[stamped.length - 1].timestamp;
    // Small numbers are offsets in seconds from the call start.
    const fromTurns =
      typeof first === "number" && typeof last === "number" && last < 1e6
        ? toSeconds(last - first)
        : spanSeconds(first, last);
    if (fromTurns !== null) return { seconds: fromTurns, source: "transcript_timestamps" };
  }

  return { seconds: 0, source: "none" };
}

export interface CallClassification {
  isReal: boolean;
  /** Why a call did not count; empty for a real call. */
  reasons: string[];
}

/**
 * Agent versions up to 29 send only the extracted variables to the on_end
 * tool: no duration, no transcript. Such a payload can only be judged by
 * call_outcome. Remove once no committed version sends it.
 */
export function isLegacyPayload(body: Record<string, any>): boolean {
  const hasDuration = [...DURATION_FIELDS, "interaction_start_time"].some((f) => body[f] !== undefined);
  const hasTranscript = ["interaction_transcript", "transcript", "messages"].some((f) => body[f] !== undefined);
  return !hasDuration && !hasTranscript;
}

export function classifyCall(input: {
  durationSeconds: number;
  parentTurns: number;
  callOutcome?: string | null;
  /** Judge by call_outcome only (see isLegacyPayload). */
  legacy?: boolean;
}): CallClassification {
  const reasons: string[] = [];
  if (!input.legacy && input.durationSeconds < MIN_REAL_CALL_SECONDS) {
    reasons.push(`duration ${input.durationSeconds}s < ${MIN_REAL_CALL_SECONDS}s`);
  }
  if (!input.legacy && input.parentTurns < MIN_PARENT_TURNS) {
    reasons.push(`${input.parentTurns} parent turns < ${MIN_PARENT_TURNS}`);
  }
  if (input.legacy && !String(input.callOutcome || "").trim()) {
    reasons.push("no call_outcome");
  }
  const outcome = String(input.callOutcome || "").trim().toLowerCase();
  if (NON_CONVERSATION_OUTCOMES.has(outcome)) {
    reasons.push(`call_outcome ${outcome}`);
  }
  return { isReal: reasons.length === 0, reasons };
}

const IST_OFFSET_MS = 5.5 * 3600_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-30" in India time, for daily_health_logs.log_date. */
export function istIsoDate(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "Wed, 30 Sep 2026" in India time, for the memory's LAST UPDATED line. */
export function istDateLabel(date: Date): string {
  const d = new Date(date.getTime() + IST_OFFSET_MS);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
