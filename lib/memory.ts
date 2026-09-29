/**
 * Parses Anya's working memory (parent_profiles.current_user_context and
 * call_records.previous/resulting_user_context) into structured sections.
 *
 * The memory is written by the sarvam-call-handler edge function in this shape:
 *
 *   TODAY: Mon, Sep 28, 2026 | CALL COUNT: 4
 *   BASELINE: Poonam | Child: Ved (son) | No chronic meds
 *   ROUTINE: Wakes 5:00 AM; sleeps ~10:30 PM.
 *
 *   ROLLING LOG (LAST 2 CALLS):
 *   • Mon, Sep 28, 2026 (Call #3):
 *     - Sleep: No problems reported.
 *   ACTIVE WATCHLIST:
 *   - Check whether right knee continues to improve.
 *
 * Anything that does not match is kept in `other` so nothing is hidden.
 */

export interface MemoryLogEntry {
  title: string;
  items: { label?: string; text: string }[];
}

export interface ParsedMemory {
  today?: string;
  callCount?: number;
  baseline: string[];
  routine: string[];
  log: MemoryLogEntry[];
  watchlist: string[];
  other: string[];
}

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
    log: [],
    watchlist: [],
    other: [],
  };
  if (!raw) return memory;

  let section: "log" | "watchlist" | "other" = "other";

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const today = line.match(/^TODAY:\s*(.*)$/i);
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

    if (/^ROLLING LOG\b/i.test(line)) {
      section = "log";
      continue;
    }

    if (/^ACTIVE WATCHLIST\b/i.test(line)) {
      section = "watchlist";
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

    if (section === "watchlist") {
      const bullet = line.match(/^[-–•*]\s*(.*)$/);
      memory.watchlist.push((bullet ? bullet[1] : line).trim());
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
    m.log.length === 0 &&
    m.watchlist.length === 0 &&
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
  logAdded: MemoryLogEntry[];
  baselineChanged: boolean;
  routineChanged: boolean;
}

/** What changed in Anya's memory between two versions. */
export function diffMemory(before: ParsedMemory, after: ParsedMemory): MemoryDiff {
  const beforeWatch = new Set(before.watchlist.map(normalize));
  const afterWatch = new Set(after.watchlist.map(normalize));
  // Titles vary ("Sun, Sep 27 (Call #2, 3 min)" vs "Sun, Sep 27 (Call #2)"), so match by date.
  const logKey = (e: MemoryLogEntry) => normalize(e.title.split("(")[0]);
  const beforeLog = new Set(before.log.map(logKey));

  return {
    watchlistAdded: after.watchlist.filter((w) => !beforeWatch.has(normalize(w))),
    watchlistResolved: before.watchlist.filter((w) => !afterWatch.has(normalize(w))),
    watchlistKept: after.watchlist.filter((w) => beforeWatch.has(normalize(w))),
    logAdded: after.log.filter((e) => !beforeLog.has(logKey(e))),
    baselineChanged:
      normalize(before.baseline.join(" ")) !== normalize(after.baseline.join(" ")),
    routineChanged:
      normalize(before.routine.join(" ")) !== normalize(after.routine.join(" ")),
  };
}
