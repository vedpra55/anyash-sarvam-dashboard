/**
 * One parent's story since they joined: every Sarvam call, merged with what
 * Supabase knows (daily health logs, AI reviews, the parent's own words, open
 * threads), rolled up per day and per period for the Summary and Report tabs.
 *
 * Pure functions only: numbers come from the data, never from a model.
 * Anything the parent didn't talk about is "not mentioned", never guessed.
 * Days are India days (UTC+5:30).
 */

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export interface StoryCall {
  attempt_id: string;
  /** ISO time the call was placed. */
  at: string;
  /** Connectivity from Sarvam ("connected", "completed", "no_answer", ...). */
  status: string;
  seconds: number;
  language?: string;
  /** Sarvam post-call variables. */
  outcome?: string;
  summary?: string;
  health?: string;
  mood?: string;
  moodNote?: string;
  followUpNeeded?: string;
  followUpDetail?: string;
}

export interface StoryLog {
  log_date: string;
  sleep_hours?: number | null;
  sleep_quality?: string | null;
  appetite?: string | null;
  meals_reported?: Record<string, string | null> | null;
  medication_adherence?: { adherence?: string | null; refill_warnings?: string | null } | null;
  mobility_and_pain?: { pain_reported?: boolean | null; nature?: string | null; locations?: string[] | null } | null;
  mood_and_energy?: { mood?: string | null; energy_level?: string | null } | null;
  incidents_red_flags?: string | null;
}

export interface StoryReview {
  attempt_id: string;
  at: string;
  decision?: string | null; // NORMAL | MONITOR | FAMILY_NOTIFICATION | ESCALATION
  observation?: string | null;
  action?: string | null;
}

export interface StoryEvent {
  date: string;
  category: string;
  words: string;
  summary?: string | null;
  importance: number;
}

export interface StoryThread {
  title: string;
  kind?: string | null;
  status: string;
  importance: number;
  last_words?: string | null;
  next_ask_on?: string | null;
  last_update?: string | null;
}

export interface StoryInput {
  /** ISO time the parent was added; the story starts at the earlier of this and the first call. */
  joinedAt?: string | null;
  calls: StoryCall[];
  logs: StoryLog[];
  reviews: StoryReview[];
  events: StoryEvent[];
  threads: StoryThread[];
  /** "mother" | "father" | "" */
  role?: string | null;
  honorific?: string | null;
  now?: Date;
}

/* ------------------------------------------------------------------ */
/* Days                                                                */
/* ------------------------------------------------------------------ */

const IST_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" of the India day an instant falls on. */
export function istDay(ms: number): string {
  return new Date(ms + IST_MS).toISOString().slice(0, 10);
}

/** Midnight UTC of a day key, for date arithmetic only. */
const keyMs = (key: string) => Date.parse(`${key}T00:00:00Z`);
export const addDays = (key: string, n: number) => new Date(keyMs(key) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((keyMs(b) - keyMs(a)) / DAY_MS);

export type Area = "food" | "sleep" | "medicine" | "body" | "mood";
export const AREAS: Area[] = ["food", "sleep", "medicine", "body", "mood"];

/** g good, o okay, w keep an eye, a alert, n not mentioned, x no conversation that day */
export type Mark = "g" | "o" | "w" | "a" | "n" | "x";

export type DayState = "talked" | "missed" | "none";

export interface Day {
  key: string;
  state: DayState;
  /** Minutes on calls that connected. */
  minutes: number;
  calls: StoryCall[];
  marks: Record<Area, Mark>;
  /** Short note per area, from the daily log or Sarvam. */
  notes: Partial<Record<Area, string>>;
  /** The parent shared a life moment that day. */
  moment: boolean;
}

const CONNECTED = new Set(["connected", "completed"]);
const TALK_OUTCOMES = new Set(["meaningful_checkin", "partial_checkin"]);
const NO_TALK_OUTCOMES = new Set(["busy_or_refused", "wrong_person", "no_conversation", "test_call"]);

export const isReached = (c: StoryCall) => CONNECTED.has(c.status);

/**
 * A real conversation: connected, and Sarvam either says it was a check-in
 * or (with no verdict) it lasted at least 45 s, the same bar the memory
 * pipeline uses.
 */
export function isConversation(c: StoryCall): boolean {
  if (!isReached(c)) return false;
  if (c.outcome && TALK_OUTCOMES.has(c.outcome)) return true;
  if (c.outcome && NO_TALK_OUTCOMES.has(c.outcome)) return false;
  return c.seconds >= 45;
}

const has = (s: string | null | undefined, re: RegExp) => Boolean(s && re.test(s.toLowerCase()));

function foodMark(log?: StoryLog): Mark {
  if (!log) return "n";
  if (has(log.appetite, /poor|very low|none|not eat/)) return "w";
  if (has(log.appetite, /low|less|reduced|decreas/)) return "o";
  if (has(log.appetite, /good|normal|fine|ok|well/)) return "g";
  const meals = Object.entries(log.meals_reported || {}).filter(([k]) => k !== "appetite");
  if (meals.some(([, v]) => has(v, /skip|missed|didn't|did not|nothing/))) return "o";
  if (meals.some(([, v]) => v && v.trim())) return "g";
  return "n";
}

function sleepMark(log?: StoryLog): Mark {
  if (!log) return "n";
  if (has(log.sleep_quality, /poor|bad|disturb|couldn|little|not/)) return "w";
  if (has(log.sleep_quality, /fair|ok|average|light|so-so/)) return "o";
  if (has(log.sleep_quality, /good|well|sound|fine|deep/)) return "g";
  const h = Number(log.sleep_hours);
  if (log.sleep_hours != null && !isNaN(h)) return h >= 6 ? "g" : h >= 5 ? "o" : "w";
  return "n";
}

function medicineMark(log?: StoryLog): Mark {
  if (!log) return "n";
  const a = log.medication_adherence?.adherence;
  if (has(a, /miss|skip|forg|not tak|didn/)) return "w";
  if (has(a, /partial|some|late/)) return "o";
  if (has(a, /taken|took|yes|all|full|regular|on time/)) return "g";
  if (log.medication_adherence?.refill_warnings?.trim()) return "o";
  return "n";
}

function bodyMark(log?: StoryLog): Mark {
  if (!log) return "n";
  if (log.incidents_red_flags?.trim()) return "a";
  const p = log.mobility_and_pain;
  if (p?.pain_reported === true) return "w";
  if (p?.pain_reported === false) return p.nature?.trim() ? "o" : "g";
  return "n";
}

const MOOD_MARK: Record<string, Mark> = {
  calm_positive: "g",
  neutral: "o",
  mixed: "o",
  low_or_flat: "w",
  anxious_or_worried: "w",
  irritable: "w",
};

function moodMark(calls: StoryCall[], log?: StoryLog): Mark {
  const fromSarvam = calls.map((c) => (c.mood ? MOOD_MARK[c.mood] : undefined)).filter(Boolean) as Mark[];
  if (fromSarvam.length) return worst(fromSarvam);
  const m = log?.mood_and_energy?.mood;
  if (has(m, /low|sad|anxious|worr|upset|irrit|lonely|tired/)) return "w";
  if (has(m, /cheer|happy|positive|calm|content|good|engaged/)) return "g";
  if (m && m.trim()) return "o";
  return "n";
}

const SEVERITY: Record<Mark, number> = { a: 5, w: 4, o: 3, g: 2, n: 1, x: 0 };
const worst = (marks: Mark[]): Mark => marks.reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), marks[0] || "n");

function areaNotes(log?: StoryLog): Partial<Record<Area, string>> {
  if (!log) return {};
  const notes: Partial<Record<Area, string>> = {};
  const meals = Object.entries(log.meals_reported || {})
    .filter(([k, v]) => k !== "appetite" && v && v.trim())
    .map(([k, v]) => `${k}: ${v}`);
  if (meals.length) notes.food = meals.join("; ");
  else if (log.appetite) notes.food = `Appetite ${log.appetite}`;
  if (log.sleep_quality || log.sleep_hours) notes.sleep = [log.sleep_quality, log.sleep_hours ? `${log.sleep_hours} h` : ""].filter(Boolean).join(", ");
  if (log.medication_adherence?.refill_warnings?.trim()) notes.medicine = log.medication_adherence.refill_warnings.trim();
  else if (log.medication_adherence?.adherence) notes.medicine = log.medication_adherence.adherence;
  if (log.mobility_and_pain?.nature?.trim()) notes.body = log.mobility_and_pain.nature.trim();
  if (log.mood_and_energy?.mood?.trim()) notes.mood = log.mood_and_energy.mood.trim();
  for (const k of Object.keys(notes) as Area[]) notes[k] = notes[k]!.charAt(0).toUpperCase() + notes[k]!.slice(1);
  return notes;
}

/* ------------------------------------------------------------------ */
/* The whole story                                                     */
/* ------------------------------------------------------------------ */

export type Tone = "good" | "watch" | "notify" | "urgent" | "neutral";

export interface Story {
  start: string;
  today: string;
  days: Day[];
  /** Day number of today since the start (1-based). */
  dayNumber: number;
  daysTalked: number;
  minutes: number;
  calls: number;
  streak: number;
  bestStreak: number;
  bestStreakStart: string | null;
  firstCall: string | null;
  status: { tone: Tone; label: string; line: string };
  latest: StoryCall | null;
  latestQuote: StoryEvent | null;
  following: StoryThread[];
  events: StoryEvent[];
  reviews: StoryReview[];
  words: { she: string; her: string; hers: string; name: string };
}

export function pronouns(role?: string | null, honorific?: string | null) {
  const name = (honorific || "").trim();
  if (role === "mother") return { she: "she", her: "her", hers: "her", name: name || "Mom" };
  if (role === "father") return { she: "he", her: "him", hers: "his", name: name || "Dad" };
  return { she: "they", her: "them", hers: "their", name: name || "your parent" };
}

const DECISION: Record<string, { tone: Tone; label: string }> = {
  ESCALATION: { tone: "urgent", label: "Needs attention" },
  FAMILY_NOTIFICATION: { tone: "notify", label: "Let the family know" },
  MONITOR: { tone: "watch", label: "Keep an eye" },
  NORMAL: { tone: "good", label: "All good" },
};

export function buildStory(input: StoryInput): Story {
  const now = input.now || new Date();
  const today = istDay(now.getTime());
  const calls = [...input.calls]
    .filter((c) => !isNaN(Date.parse(c.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const firstCall = calls.length ? istDay(Date.parse(calls[0].at)) : null;
  const joined = input.joinedAt && !isNaN(Date.parse(input.joinedAt)) ? istDay(Date.parse(input.joinedAt)) : null;
  let start = [joined, firstCall].filter(Boolean).sort()[0] || today;
  if (start > today) start = today;

  const logByDay = new Map(input.logs.map((l) => [l.log_date, l]));
  const momentDays = new Set(input.events.filter((e) => e.category === "life" && e.importance >= 2).map((e) => e.date));
  const callsByDay = new Map<string, StoryCall[]>();
  for (const c of calls) {
    const k = istDay(Date.parse(c.at));
    callsByDay.set(k, [...(callsByDay.get(k) || []), c]);
  }

  const days: Day[] = [];
  for (let k = start; k <= today; k = addDays(k, 1)) {
    const dayCalls = callsByDay.get(k) || [];
    const talkedCalls = dayCalls.filter(isConversation);
    const state: DayState = talkedCalls.length ? "talked" : dayCalls.length ? "missed" : "none";
    const log = logByDay.get(k);
    const talked = state === "talked" || Boolean(log);
    const marks = {} as Record<Area, Mark>;
    if (!talked) for (const a of AREAS) marks[a] = "x";
    else {
      marks.food = foodMark(log);
      marks.sleep = sleepMark(log);
      marks.medicine = medicineMark(log);
      marks.body = bodyMark(log);
      marks.mood = moodMark(talkedCalls, log);
    }
    days.push({
      key: k,
      // A health log means a conversation happened, even if Sarvam lists none.
      state: log ? "talked" : state,
      minutes: Math.round(dayCalls.filter(isReached).reduce((s, c) => s + c.seconds, 0) / 6) / 10,
      calls: dayCalls,
      marks,
      notes: areaNotes(log),
      moment: momentDays.has(k),
    });
  }

  // Streaks: consecutive talked days. Today still counts toward the streak
  // until it ends without a conversation.
  let run = 0;
  let best = 0;
  let bestStart: string | null = null;
  for (let i = 0; i < days.length; i++) {
    if (days[i].state === "talked") {
      run++;
      if (run > best) {
        best = run;
        bestStart = days[i - run + 1].key;
      }
    } else run = 0;
  }
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].state === "talked") streak++;
    else if (i === days.length - 1) continue; // today, not talked yet
    else break;
  }

  const reviews = [...input.reviews].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const talkedCalls = calls.filter(isConversation);
  const latest = calls.length ? calls[calls.length - 1] : null;
  const latestTalk = talkedCalls.length ? talkedCalls[talkedCalls.length - 1] : null;
  const events = [...input.events].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.importance - a.importance));
  const latestQuote = events.find((e) => e.words && e.words.trim().length > 6) || null;

  return {
    start,
    today,
    days,
    dayNumber: daysBetween(start, today) + 1,
    daysTalked: days.filter((d) => d.state === "talked").length,
    minutes: Math.round(calls.filter(isReached).reduce((s, c) => s + c.seconds, 0) / 60),
    calls: calls.length,
    streak,
    bestStreak: best,
    bestStreakStart: bestStart,
    firstCall,
    status: overallStatus(reviews, latestTalk, days),
    latest,
    latestQuote,
    following: input.threads
      .filter((t) => t.status === "open")
      .sort((a, b) => b.importance - a.importance || String(a.next_ask_on || "").localeCompare(String(b.next_ask_on || "")))
      .slice(0, 6),
    events,
    reviews,
    words: pronouns(input.role, input.honorific),
  };
}

function overallStatus(reviews: StoryReview[], latestTalk: StoryCall | null, days: Day[]): Story["status"] {
  const recent = days.slice(-3);
  if (days.length >= 3 && recent.every((d) => d.state !== "talked")) {
    return { tone: "watch", label: "Not reached lately", line: "No conversation in the last 3 days." };
  }
  const review = reviews.find((r) => r.decision && DECISION[r.decision]);
  if (review && (!latestTalk || Date.parse(review.at) >= Date.parse(latestTalk.at) - 6 * 3_600_000)) {
    const d = DECISION[review.decision!];
    return { ...d, line: firstSentences(review.observation || latestTalk?.summary || "") };
  }
  if (latestTalk) {
    const flagged = latestTalk.followUpNeeded === "yes";
    return {
      tone: flagged ? "watch" : "good",
      label: flagged ? "Keep an eye" : "All good",
      line: firstSentences((flagged && latestTalk.followUpDetail) || latestTalk.summary || ""),
    };
  }
  return { tone: "neutral", label: "No conversation yet", line: "Anyash hasn't had a real conversation yet." };
}

/** The first one or two sentences, for one-line summaries. */
export function firstSentences(text: string, max = 2): string {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+/g);
  if (!parts) return text.trim();
  return parts.slice(0, max).map((x) => x.trim()).join(" ");
}

/* ------------------------------------------------------------------ */
/* Periods                                                             */
/* ------------------------------------------------------------------ */

export type PeriodKind = "day" | "week" | "month";

export interface Period {
  kind: PeriodKind;
  from: string;
  to: string;
  /** "Saturday, 3 Oct" / "27 Sep – 3 Oct" / "October" */
  label: string;
  /** "Day 33 with Anyash" / "Week 5 since she joined" / "Month 2" */
  context: string;
  /** "Today" / "This week" / "This month" when the period includes today. */
  relative: string | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Fixed English formats ("3 Oct", "Saturday 3 Oct", "October 2026"), the same in every browser. */
function fmtKey(key: string, opts: { weekday?: "long" | "short"; day?: "numeric"; month?: "short" | "long"; year?: "numeric" }) {
  const d = new Date(keyMs(key));
  const parts: string[] = [];
  if (opts.weekday) parts.push(opts.weekday === "long" ? WEEKDAYS[d.getUTCDay()] : WEEKDAYS[d.getUTCDay()].slice(0, 3));
  if (opts.day) parts.push(String(d.getUTCDate()));
  if (opts.month) parts.push(opts.month === "long" ? MONTHS_LONG[d.getUTCMonth()] : MONTHS[d.getUTCMonth()]);
  if (opts.year) parts.push(String(d.getUTCFullYear()));
  return parts.join(" ");
}

export function period(kind: PeriodKind, anchor: string, story: Pick<Story, "start" | "today" | "words">): Period {
  if (kind === "day") {
    const n = daysBetween(story.start, anchor) + 1;
    return {
      kind,
      from: anchor,
      to: anchor,
      label: fmtKey(anchor, { weekday: "long", day: "numeric", month: "short" }),
      context: n >= 1 ? `Day ${n} with Anyash` : "Before Anyash",
      relative: anchor === story.today ? "Today" : anchor === addDays(story.today, -1) ? "Yesterday" : null,
    };
  }
  if (kind === "week") {
    const from = addDays(anchor, -6);
    const n = Math.floor(daysBetween(story.start, anchor) / 7) + 1;
    return {
      kind,
      from,
      to: anchor,
      label: `${fmtKey(from, { day: "numeric", month: "short" })} – ${fmtKey(anchor, { day: "numeric", month: "short" })}`,
      context: n <= 1 ? "First week with Anyash" : `Week ${n} since ${story.words.she} joined`,
      relative: anchor === story.today ? "This week" : null,
    };
  }
  const from = `${anchor.slice(0, 8)}01`;
  const monthEnd = addDays(`${addDays(from, 32).slice(0, 8)}01`, -1);
  const to = monthEnd < story.today ? monthEnd : story.today;
  const n = (Number(from.slice(0, 4)) - Number(story.start.slice(0, 4))) * 12 + Number(from.slice(5, 7)) - Number(story.start.slice(5, 7)) + 1;
  return {
    kind,
    from,
    to,
    label: fmtKey(from, { month: "long", year: "numeric" }),
    context: n <= 1 ? "First month with Anyash" : `Month ${n} with Anyash`,
    relative: to === story.today ? "This month" : null,
  };
}

export interface AreaSummary {
  area: Area;
  marks: Mark[];
  /** The status that best describes the period. */
  mark: Mark;
  word: string;
  /** Days the area came up, of days talked. */
  mentioned: number;
  /** Month only: share of good days per week, 0–100, or null with no mentions. */
  weeks?: (number | null)[];
}

export interface Report {
  period: Period;
  days: Day[];
  daysTalked: number;
  calls: StoryCall[];
  conversations: number;
  minutes: number;
  areas: AreaSummary[];
  status: { tone: Tone; label: string; line: string };
  heard: { what: string; todo: string; at: string }[];
  quotes: StoryEvent[];
  next: StoryThread[];
}

const WORDS: Record<Area, Partial<Record<Mark, string>>> = {
  food: { g: "Eating well", o: "Eating a bit less", w: "Not eating well", n: "Not talked about" },
  sleep: { g: "Sleeping well", o: "Sleep so-so", w: "Poor sleep", n: "Not talked about" },
  medicine: { g: "Taking medicines", o: "Mostly on track", w: "Missed medicines", n: "Not talked about" },
  body: { g: "No pain", o: "Some aches", w: "Pain mentioned", a: "Something happened", n: "Not talked about" },
  mood: { g: "Cheerful", o: "Steady", w: "A bit low", n: "Not talked about" },
};

/** The period's word: any alert wins; otherwise the most common mentioned status (worse wins ties). */
function periodMark(marks: Mark[]): Mark {
  const seen = marks.filter((m) => m !== "n" && m !== "x");
  if (!seen.length) return "n";
  if (seen.includes("a")) return "a";
  const count = (m: Mark) => seen.filter((x) => x === m).length;
  // Keep-an-eye days count double: two pain days in a week deserve a mention.
  const score: [Mark, number][] = [
    ["w", count("w") * 2],
    ["o", count("o")],
    ["g", count("g")],
  ];
  return score.sort((a, b) => b[1] - a[1] || SEVERITY[b[0]] - SEVERITY[a[0]])[0][0];
}

export function buildReport(story: Story, kind: PeriodKind, anchor: string): Report {
  const p = period(kind, anchor, story);
  const days = story.days.filter((d) => d.key >= p.from && d.key <= p.to);
  const calls = days.flatMap((d) => d.calls);
  const talked = calls.filter(isConversation);
  const inPeriod = (iso: string) => {
    const k = istDay(Date.parse(iso));
    return k >= p.from && k <= p.to;
  };

  const areas: AreaSummary[] = AREAS.map((area) => {
    const marks = days.map((d) => d.marks[area]);
    const mark = periodMark(marks);
    const summary: AreaSummary = {
      area,
      marks,
      mark,
      word: WORDS[area][mark] || WORDS[area].n!,
      mentioned: marks.filter((m) => m !== "n" && m !== "x").length,
    };
    if (kind === "month") {
      summary.weeks = [];
      for (let w = 0; w * 7 < days.length; w++) {
        const chunk = marks.slice(w * 7, w * 7 + 7).filter((m) => m !== "n" && m !== "x");
        summary.weeks.push(chunk.length ? Math.round((chunk.filter((m) => m === "g").length / chunk.length) * 100) : null);
      }
    }
    return summary;
  });

  const reviewByAttempt = new Map(story.reviews.map((r) => [r.attempt_id, r]));
  const heard = [...talked]
    .reverse()
    .map((c) => {
      const r = reviewByAttempt.get(c.attempt_id);
      const what = firstSentences(c.health || c.summary || r?.observation || "", 2);
      const todo =
        r?.action?.trim() ||
        (c.followUpNeeded === "yes" && c.followUpDetail?.trim()) ||
        "Nothing needed.";
      return { what, todo: firstSentences(todo, 1), at: c.at };
    })
    .filter((h) => h.what)
    .slice(0, kind === "day" ? 3 : 4);

  const reviews = story.reviews.filter((r) => inPeriod(r.at));
  const latestTalk = talked[talked.length - 1] || null;
  const status =
    talked.length === 0
      ? { tone: "neutral" as Tone, label: "No conversation", line: calls.length ? `Anyash called ${calls.length === 1 ? "once" : `${calls.length} times`}, but couldn't talk with ${story.words.her}.` : "No calls in this period." }
      : overallStatus(reviews, latestTalk, kind === "day" ? [] : days);

  const quotes = story.events
    .filter((e) => e.date >= p.from && e.date <= p.to && e.words.trim().length > 6)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, kind === "day" ? 1 : 3);

  return {
    period: p,
    days,
    daysTalked: days.filter((d) => d.state === "talked").length,
    calls,
    conversations: talked.length,
    minutes: Math.round(calls.filter(isReached).reduce((s, c) => s + c.seconds, 0) / 60),
    areas,
    status,
    heard,
    quotes,
    next: story.following.slice(0, 3),
  };
}

/** Pain-mention days per week for the last `weeks` weeks (oldest first), for the Body trend. */
export function weeklyMentions(story: Story, area: Area, weeks = 4): number[] {
  const out: number[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const to = addDays(story.today, -7 * w);
    const from = addDays(to, -6);
    out.push(story.days.filter((d) => d.key >= from && d.key <= to && (d.marks[area] === "w" || d.marks[area] === "a")).length);
  }
  return out;
}

/** "7:10 PM · 2 h ago", "Yesterday, 9:41 PM", "Last Tuesday, 9:48 PM", "21 Sep, 8:00 PM". */
export function whenLabel(iso: string, now = new Date()): string {
  const ms = Date.parse(iso);
  const time = new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const day = istDay(ms);
  const today = istDay(now.getTime());
  const diff = daysBetween(day, today);
  if (diff === 0) {
    const mins = Math.round((now.getTime() - ms) / 60000);
    const ago = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
    return `Today, ${time} · ${ago}`;
  }
  if (diff === 1) return `Yesterday, ${time}`;
  if (diff < 7) return `Last ${fmtKey(day, { weekday: "long" })}, ${time}`;
  return `${fmtKey(day, { day: "numeric", month: "short" })}, ${time}`;
}

export const shortDate = (key: string) => fmtKey(key, { day: "numeric", month: "short" });
export const longDate = (key: string) => fmtKey(key, { weekday: "long", day: "numeric", month: "short" });
export const weekdayShort = (key: string) => fmtKey(key, { weekday: "short" });
