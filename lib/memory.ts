/**
 * Parses Anya's working memory (parent_profiles.current_user_context and
 * call_records.previous/resulting_user_context) into structured sections.
 *
 * The memory is written by the sarvam-call-handler edge function in this shape:
 *
 *   LAST UPDATED: Mon, 28 Sep 2026 | CALL COUNT: 4   (older memories: TODAY: ...)
 *   BASELINE: Poonam | Child: Ved (son) | No chronic meds
 *   ROUTINE: Wakes 5:00 AM; sleeps ~10:30 PM.
 *   PERSONAL: Lives with son's family; grandson Aarav; enjoys bhajans.
 *
 *   ROLLING LOG (LAST 2 CALLS):
 *   • Mon, Sep 28, 2026 (Call #3):
 *     - Sleep: No problems reported.
 *   ACTIVE WATCHLIST:
 *   - Check whether right knee continues to improve.
 *   LIFE THREADS:
 *   - Power cut and heat yesterday.
 *
 * Anything that does not match is kept in `other` so nothing is hidden.
 */

export interface MemoryLogEntry {
  title: string;
  items: { label?: string; text: string }[];
}

export interface ParsedMemory {
  /** Date of the LAST UPDATED (or older TODAY) line. */
  today?: string;
  callCount?: number;
  baseline: string[];
  routine: string[];
  personal: string[];
  log: MemoryLogEntry[];
  watchlist: string[];
  lifeThreads: string[];
  /** Starting notes from the child's onboarding (PERSON, DAY, HEALTH, LIFE, AVOID, NOTE). */
  fromFamily: { label: string; text: string }[];
  other: string[];
}

const FAMILY_LABELS: Record<string, string> = {
  PERSON: "Person",
  DAY: "Day",
  HEALTH: "Health",
  LIFE: "Life",
  AVOID: "Avoid",
  NOTE: "Note",
};

function splitList(value: string, separator: RegExp): string[] {
  return value
    .split(separator)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

export function parseMemory(raw?: string | null): ParsedMemory {
  const memory: ParsedMemory = {
    baseline: [],
    routine: [],
    personal: [],
    log: [],
    watchlist: [],
    lifeThreads: [],
    fromFamily: [],
    other: [],
  };
  if (!raw) return memory;

  let section: "log" | "watchlist" | "lifeThreads" | "other" = "other";

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const today = line.match(/^(?:TODAY|LAST UPDATED):\s*(.*)$/i);
    if (today) {
      const [datePart, ...rest] = today[1].split("|").map((s) => s.trim());
      memory.today = datePart;
      const count = rest.join(" ").match(/CALL COUNT:\s*(\d+)/i);
      if (count) memory.callCount = Number(count[1]);
      section = "other";
      continue;
    }

    const baseline = line.match(/^BASELINE:\s*(.*)$/i);
    if (baseline) {
      memory.baseline = splitList(baseline[1], /\s*\|\s*/);
      section = "other";
      continue;
    }

    const routine = line.match(/^ROUTINE:\s*(.*)$/i);
    if (routine) {
      memory.routine = splitList(routine[1], /\s*;\s*/);
      section = "other";
      continue;
    }

    const family = line.match(/^(?!LIFE THREADS)(PERSON|DAY|HEALTH|LIFE|AVOID|NOTE)\b[^:]*:\s*(.*)$/);
    if (family) {
      memory.fromFamily.push({ label: FAMILY_LABELS[family[1]], text: family[2].trim() });
      section = "other";
      continue;
    }

    const personal = line.match(/^PERSONAL:\s*(.*)$/i);
    if (personal) {
      memory.personal = /^not shared yet\.?$/i.test(personal[1].trim()) ? [] : splitList(personal[1], /\s*;\s*/);
      section = "other";
      continue;
    }

    if (/^ROLLING LOG\b/i.test(line)) {
      section = "log";
      continue;
    }

    if (/^ACTIVE WATCHLIST\b/i.test(line)) {
      section = "watchlist";
      continue;
    }

    if (/^LIFE THREADS\b/i.test(line)) {
      section = "lifeThreads";
      continue;
    }

    if (section === "log") {
      const entry = line.match(/^[•*]\s*(.*)$/);
      if (entry) {
        const [title, ...inline] = entry[1].replace(/:\s*$/, "").split(/\):\s*/);
        const fullTitle = inline.length > 0 ? `${title})` : title;
        const item: MemoryLogEntry = { title: fullTitle.trim(), items: [] };
        if (inline.length > 0 && inline.join("").trim()) {
          item.items.push({ text: inline.join("): ").trim() });
        }
        memory.log.push(item);
        continue;
      }
      const bullet = line.match(/^[-–]\s*(.*)$/);
      if (bullet && memory.log.length > 0) {
        const kv = bullet[1].match(/^([A-Za-z/ ]{2,24}):\s*(.*)$/);
        memory.log[memory.log.length - 1].items.push(
          kv ? { label: kv[1].trim(), text: kv[2].trim() } : { text: bullet[1].trim() }
        );
        continue;
      }
    }

    if (section === "watchlist" || section === "lifeThreads") {
      const bullet = line.match(/^[-–•*]\s*(.*)$/);
      const item = (bullet ? bullet[1] : line).trim();
      if (!/^none( yet)?\.?$/i.test(item)) memory[section].push(item);
      continue;
    }

    memory.other.push(line);
  }

  return memory;
}

export function isEmptyMemory(m: ParsedMemory): boolean {
  return (
    m.baseline.length === 0 &&
    m.routine.length === 0 &&
    m.personal.length === 0 &&
    m.log.length === 0 &&
    m.watchlist.length === 0 &&
    m.lifeThreads.length === 0 &&
    m.fromFamily.length === 0 &&
    m.other.length === 0
  );
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface MemoryDiff {
  watchlistAdded: string[];
  /** Items no longer on the watchlist (resolved, or reworded by the AI). */
  watchlistResolved: string[];
  watchlistKept: string[];
  lifeThreadsAdded: string[];
  lifeThreadsClosed: string[];
  logAdded: MemoryLogEntry[];
  baselineChanged: boolean;
  routineChanged: boolean;
  personalChanged: boolean;
}

/** What changed in Anya's memory between two versions. */
export function diffMemory(before: ParsedMemory, after: ParsedMemory): MemoryDiff {
  const beforeWatch = new Set(before.watchlist.map(normalize));
  const afterWatch = new Set(after.watchlist.map(normalize));
  // Titles vary ("Sun, Sep 27 (Call #2, 3 min)" vs "Sun, Sep 27 (Call #2)"), so match by date.
  const logKey = (e: MemoryLogEntry) => normalize(e.title.split("(")[0]);
  const beforeLog = new Set(before.log.map(logKey));
  const beforeThreads = new Set(before.lifeThreads.map(normalize));
  const afterThreads = new Set(after.lifeThreads.map(normalize));

  return {
    watchlistAdded: after.watchlist.filter((w) => !beforeWatch.has(normalize(w))),
    watchlistResolved: before.watchlist.filter((w) => !afterWatch.has(normalize(w))),
    watchlistKept: after.watchlist.filter((w) => beforeWatch.has(normalize(w))),
    lifeThreadsAdded: after.lifeThreads.filter((t) => !beforeThreads.has(normalize(t))),
    lifeThreadsClosed: before.lifeThreads.filter((t) => !afterThreads.has(normalize(t))),
    logAdded: after.log.filter((e) => !beforeLog.has(logKey(e))),
    baselineChanged:
      normalize(before.baseline.join(" ")) !== normalize(after.baseline.join(" ")),
    routineChanged:
      normalize(before.routine.join(" ")) !== normalize(after.routine.join(" ")),
    personalChanged:
      normalize(before.personal.join(" ")) !== normalize(after.personal.join(" ")),
  };
}
