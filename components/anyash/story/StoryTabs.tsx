"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, EyeOff, Eye, Play, X } from "lucide-react";
import { useStory } from "@/lib/queries";
import {
  AREAS,
  Area,
  PeriodKind,
  Story,
  StoryCall,
  addDays,
  buildReport,
  buildStory,
  isConversation,
  isReached,
  longDate,
  shortDate,
  weeklyMentions,
  whenLabel,
} from "@/lib/story";
import { Button, EmptyState, Segmented } from "../primitives";
import { StatusLabel, formatDuration } from "../detail-ui";
import { CalendarCheckIcon, CallIcon, ChatIcon, Diya, MissedCallIcon, PinIcon, WeekIcon, WordsIcon } from "./icons";
import { AreaRow, ConversationPulse, CountUp, MarkLegend, MoodFace, Strip, StoryCalendar, TalkDots, TrendBars } from "./visuals";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

interface StorySection {
  id: string;
  name: string;
  node: React.ReactNode;
}

interface BuildOpts {
  /** Present mode: icons move, numbers count up. */
  live: boolean;
  /** The name shown on screen (the honorific in private mode). */
  name: string;
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

function Heading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-4">
      <h3 className="text-[13px] font-medium text-zinc-500">{children}</h3>
      {aside}
    </div>
  );
}

/** One figure: a small labelled icon, the number with its unit, and one quiet line. */
function Stat({
  icon,
  label,
  value,
  unit,
  meta,
  live,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  meta: React.ReactNode;
  live: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-400 whitespace-nowrap">
        <span className="text-[#FEE5A5] flex items-center">{icon}</span>
        {label}
      </p>
      <p className="mt-2.5 flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[34px] sm:text-[38px] font-semibold text-white tabular-nums leading-none tracking-tight">
          <CountUp value={value} live={live} />
        </span>
        <span className="text-[14px] text-zinc-500">{unit}</span>
      </p>
      <p className="mt-2 text-[12.5px] text-zinc-500 truncate">{meta}</p>
    </div>
  );
}

function useStoryData(parentId: string, now?: Date) {
  const q = useStory(parentId);
  const story = useMemo(() => {
    if (!q.data) return null;
    const d = q.data;
    return buildStory({
      joinedAt: d.joinedAt,
      calls: d.calls || [],
      logs: d.logs || [],
      reviews: d.reviews || [],
      events: d.events || [],
      threads: d.threads || [],
      role: d.parent?.role,
      honorific: d.parent?.honorific,
      now,
    });
  }, [q.data, now]);
  return { q, story, meta: q.data?.parent as { name: string; honorific?: string; language?: string } | undefined, sarvamError: q.data?.sarvamError as string | null };
}

function StoryState({ q, story, children }: { q: ReturnType<typeof useStory>; story: Story | null; children: React.ReactNode }) {
  if (q.isPending) {
    return (
      <div className="pt-8 space-y-6 animate-pulse" aria-label="Loading">
        <div className="h-4 w-64 rounded bg-white/[0.05]" />
        <div className="h-8 w-80 rounded bg-white/[0.05]" />
        <div className="grid grid-cols-4 gap-6">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded bg-white/[0.04]" />)}</div>
        <div className="h-48 rounded bg-white/[0.03]" />
      </div>
    );
  }
  if (q.isError && !q.data) {
    return (
      <EmptyState title="Couldn't load this parent's story." action={<Button size="sm" onClick={() => q.refetch()}>Try again</Button>}>
        {(q.error as Error).message}
      </EmptyState>
    );
  }
  if (!story) return null;
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

function summarySections(story: Story, { live, name }: BuildOpts): StorySection[] {
  const w = story.words;
  const today = story.days[story.days.length - 1];
  const callsToday = today?.calls.length || 0;
  const week = story.days.slice(-7);
  const weekTalked = week.filter((d) => d.state === "talked").length;
  const latestTalk = [...story.days].reverse().flatMap((d) => [...d.calls].reverse()).find(isConversation) || null;
  const latest = story.latest;
  const last14 = story.days.slice(-14);
  const perDay = story.daysTalked ? Math.round(story.minutes / story.daysTalked) : 0;
  const latestNote = (area: Area) => [...last14].reverse().find((d) => d.notes[area])?.notes[area];
  const pain = weeklyMentions(story, "body", 4);

  const sections: StorySection[] = [
    {
      id: "now",
      name: "Right now",
      node: (
        <section>
          <p className="text-[12.5px] text-zinc-500">
            {longDate(story.today)}
            <span className="text-zinc-700 mx-2">·</span>Day {story.dayNumber} with Anyash
            {callsToday > 0 && (
              <>
                <span className="text-zinc-700 mx-2">·</span>
                {callsToday === 1 ? "1 call today" : `${ordinal(callsToday)} call today`}
              </>
            )}
          </p>
          {/* The page header already shows the name; Present mode has no header. */}
          {live && <h2 className="mt-3 text-[30px] sm:text-[34px] font-semibold text-white tracking-tight leading-tight">{name}</h2>}
          <div className="mt-3 text-[17px] font-medium">
            <StatusLabel tone={story.status.tone}>{story.status.label}</StatusLabel>
          </div>
          {story.status.line && <p className="mt-2 text-[15px] leading-7 text-zinc-300 max-w-[62ch]">{story.status.line}</p>}
        </section>
      ),
    },
    {
      id: "numbers",
      name: "In numbers",
      node: (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-8">
          <Stat
            icon={<CalendarCheckIcon className="w-4 h-4" />}
            label="Days talked"
            value={story.daysTalked}
            unit={`of ${story.dayNumber}`}
            meta={`Since ${shortDate(story.start)}`}
            live={live}
          />
          <Stat
            icon={<ChatIcon className="w-4 h-4" />}
            label="Time talking"
            value={story.minutes}
            unit="min"
            meta={perDay ? `About ${perDay} min a day` : "No conversation yet"}
            live={live}
          />
          <Stat
            icon={<Diya days={story.streak} className="w-[18px] h-[18px] -my-0.5" live={live} />}
            label="Streak"
            value={story.streak}
            unit={story.streak === 1 ? "day" : "days"}
            meta={
              story.streak === 0
                ? "Starts with the next chat"
                : story.bestStreak > story.streak
                  ? `Best ${story.bestStreak} days`
                  : story.streak > 1
                    ? "Longest so far"
                    : "Keep it going"
            }
            live={live}
          />
          <Stat
            icon={<WeekIcon className="w-4 h-4" />}
            label="This week"
            value={weekTalked}
            unit="of 7 days"
            meta={
              <span className="ay-dots inline-flex gap-1 align-middle" aria-hidden>
                {week.map((d, i) => (
                  <span
                    key={d.key}
                    className="w-2 h-2 rounded-full"
                    style={{
                      ["--i" as string]: i,
                      background: d.state === "talked" ? "#FEE5A5" : "transparent",
                      boxShadow: d.state === "talked" ? undefined : `inset 0 0 0 1.25px ${d.state === "missed" ? "rgba(254,229,165,.45)" : "#3F3F46"}`,
                    } as React.CSSProperties}
                  />
                ))}
              </span>
            }
            live={live}
          />
        </section>
      ),
    },
    {
      id: "latest",
      name: "Latest call",
      node: (
        <section>
          <Heading>Latest call</Heading>
          {latest ? (
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] items-start">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[13px] text-zinc-400">
                  {isReached(latest) ? <CallIcon className="w-4 h-4 text-zinc-300" live={live} /> : <MissedCallIcon className="w-4 h-4 text-zinc-400" />}
                  {whenLabel(latest.at)}
                  {isReached(latest) && latest.seconds > 0 && <span className="tabular-nums">· {formatDuration(latest.seconds)}</span>}
                  {latest.language && <span>· {latest.language}</span>}
                  {!isReached(latest) && <span>· no answer</span>}
                </p>
                {story.latestQuote && (
                  <blockquote className="mt-4 flex gap-3">
                    <WordsIcon className="w-6 h-6 shrink-0 mt-0.5 text-zinc-300" />
                    <div className="min-w-0">
                      <p className="text-[20px] sm:text-[22px] leading-snug text-white">“{story.latestQuote.words}”</p>
                      <p className="mt-1 text-[12.5px] text-zinc-500">In {w.hers} words · {shortDate(story.latestQuote.date)}</p>
                    </div>
                  </blockquote>
                )}
                {latestTalk?.summary && <p className="mt-4 text-[14px] leading-7 text-zinc-300 max-w-[62ch]">{latestTalk.summary}</p>}
                {!latestTalk && <p className="mt-4 text-[14px] text-zinc-500">No real conversation yet.</p>}
              </div>
              {latestTalk && (
                <div className="flex sm:flex-col items-center gap-2 sm:pt-1">
                  <MoodFace mark={today?.marks.mood && today.marks.mood !== "x" ? today.marks.mood : "g"} size={44} />
                  <span className="text-[12.5px] text-zinc-400">{MOOD_WORD[latestTalk.mood || ""] || "Mood not noted"}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[14px] text-zinc-500">No calls yet.</p>
          )}
        </section>
      ),
    },
    {
      id: "calendar",
      name: "Every day",
      node: (
        <section>
          <Heading aside={<span className="text-[12px] text-zinc-600">{shortDate(story.start)} – today</span>}>Every day with Anyash</Heading>
          <StoryCalendar story={story} />
        </section>
      ),
    },
    {
      id: "pulse",
      name: "Conversation pulse",
      node: (
        <section>
          <Heading>Minutes talked each day</Heading>
          <ConversationPulse story={story} />
        </section>
      ),
    },
    {
      id: "health",
      name: "Health",
      node: (
        <section>
          <Heading aside={<span className="text-[12px] text-zinc-600">{shortDate(last14[0]?.key || story.start)} – today</span>}>
            {w.hers.charAt(0).toUpperCase() + w.hers.slice(1)} health, last 14 days
          </Heading>
          <div className="divide-y divide-ay-line border-y border-ay-line">
            {AREAS.map((area) => {
              const marks = last14.map((d) => d.marks[area]);
              const seen = marks.filter((m) => m !== "n" && m !== "x");
              const lastSeen = [...marks].reverse().find((m) => m !== "n" && m !== "x") || "n";
              const word = !seen.length ? "Not talked about" : WORD[area][lastSeen] || "Not talked about";
              return (
                <AreaRow
                  key={area}
                  area={area}
                  mark={lastSeen}
                  word={word}
                  live={live}
                  aside={area === "body" && pain.some(Boolean) ? undefined : latestNote(area)}
                >
                  <div className="flex flex-col gap-2">
                    <Strip area={area} marks={marks} keys={last14.map((d) => d.key)} />
                    {area === "body" && pain.some(Boolean) && <TrendBars values={pain} unit="pain days a week" />}
                  </div>
                </AreaRow>
              );
            })}
          </div>
          <div className="mt-3">
            <MarkLegend />
          </div>
        </section>
      ),
    },
  ];

  if (story.following.length) {
    sections.push({
      id: "following",
      name: "Following",
      node: (
        <section>
          <Heading>What Anyash is following</Heading>
          <ul className="divide-y divide-ay-line border-y border-ay-line">
            {story.following.map((t) => (
              <li key={t.title} className="flex items-start gap-3 py-3.5">
                <PinIcon className="w-5 h-5 shrink-0 mt-0.5 text-zinc-300" color={t.importance >= 4 ? "#FCD34D" : "#FEE5A5"} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-zinc-100">
                    {t.title}
                    {t.importance >= 4 && <span className="ml-2 text-[12px] text-amber-200">Important</span>}
                  </p>
                  {t.last_words && <p className="mt-0.5 text-[13px] text-zinc-400 truncate">“{t.last_words}”</p>}
                </div>
                {t.next_ask_on && <span className="text-[12px] text-zinc-500 whitespace-nowrap">Asks again {t.next_ask_on <= story.today ? "next call" : shortDate(t.next_ask_on)}</span>}
              </li>
            ))}
          </ul>
        </section>
      ),
    });
  }
  return sections;
}

const MOOD_WORD: Record<string, string> = {
  calm_positive: "Calm and positive",
  neutral: "Neutral",
  mixed: "Mixed",
  low_or_flat: "A bit low",
  anxious_or_worried: "Worried",
  irritable: "Irritable",
};

const WORD: Record<Area, Record<string, string>> = {
  food: { g: "Eating well", o: "Eating a bit less", w: "Not eating well" },
  sleep: { g: "Sleeping well", o: "Sleep so-so", w: "Poor sleep" },
  medicine: { g: "Taking medicines", o: "Mostly on track", w: "Missed medicines" },
  body: { g: "No pain", o: "Some aches", w: "Pain mentioned", a: "Something happened" },
  mood: { g: "Cheerful", o: "Steady", w: "A bit low" },
};

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

function reportSections(story: Story, kind: PeriodKind, anchor: string, { live, name }: BuildOpts): StorySection[] {
  const r = buildReport(story, kind, anchor);
  const w = story.words;
  const p = r.period;
  const keys = r.days.map((d) => d.key);
  const sections: StorySection[] = [
    {
      id: "report-top",
      name: "At a glance",
      node: (
        <section>
          <p className="text-[12.5px] text-zinc-500">
            {kind === "day" ? "Daily note" : kind === "week" ? "Weekly health note" : "Monthly health note"}
            <span className="text-zinc-700 mx-2">·</span>
            {p.context}
          </p>
          <h2 className="mt-2 text-[28px] sm:text-[32px] font-semibold text-white tracking-tight leading-tight">
            {name} <span className="text-zinc-500 font-normal">· {p.relative ? `${p.relative}, ` : ""}{p.label}</span>
          </h2>
          <div className="mt-4 text-[17px] font-medium">
            <StatusLabel tone={r.status.tone}>{r.status.label}</StatusLabel>
          </div>
          {r.status.line && <p className="mt-2 text-[15px] leading-7 text-zinc-300 max-w-[62ch]">{r.status.line}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            {kind !== "day" && <TalkDots days={r.days} size={kind === "month" ? 18 : 24} />}
            <p className="text-[13px] text-zinc-400">
              {kind === "day"
                ? `${r.calls.length} ${r.calls.length === 1 ? "call" : "calls"} · ${r.conversations ? `talked ${r.minutes} min` : "no conversation"}`
                : `Talked ${r.daysTalked} of ${r.days.length} days · ${r.calls.length} calls · ${r.minutes} min`}
            </p>
          </div>
        </section>
      ),
    },
    {
      id: "report-areas",
      name: "Health",
      node: (
        <section>
          <Heading>{kind === "day" ? "Today's health" : kind === "week" ? "This week, day by day" : "Good days, week by week"}</Heading>
          <div className="divide-y divide-ay-line border-y border-ay-line">
            {r.areas.map((a) => (
              <AreaRow key={a.area} area={a.area} mark={a.mark} word={a.word} live={live}>
                {kind === "day" ? (
                  <p className="text-[13px] text-zinc-400 truncate">{r.days[0]?.notes[a.area] || (a.mark === "n" || a.mark === "x" ? "—" : a.word)}</p>
                ) : kind === "week" ? (
                  <Strip area={a.area} marks={a.marks} keys={keys} size={16} />
                ) : (
                  <span className="ay-bars flex items-end gap-1.5 h-8" aria-label="Share of good days each week">
                    {(a.weeks || []).map((v, i) => (
                      <span
                        key={i}
                        title={v === null ? "Not talked about" : `${v}% good days`}
                        className="w-6 rounded-[3px]"
                        style={{
                          height: `${v === null ? 10 : Math.max(14, v)}%`,
                          background: v === null ? "#27272A" : v >= 70 ? "#34D399" : v >= 40 ? "rgba(52,211,153,.45)" : "#FCD34D",
                          ["--i" as string]: i,
                        } as React.CSSProperties}
                      />
                    ))}
                  </span>
                )}
              </AreaRow>
            ))}
          </div>
        </section>
      ),
    },
  ];

  if (kind === "day" && r.calls.length) {
    sections.push({
      id: "report-calls",
      name: "Calls",
      node: (
        <section>
          <Heading>Calls</Heading>
          <ol className="relative border-l border-white/10 ml-2 space-y-5">
            {r.calls.map((c: StoryCall) => (
              <li key={c.attempt_id} className="pl-6 relative">
                <span className="absolute -left-[13px] top-0 w-6 h-6 rounded-full bg-ay-canvas flex items-center justify-center">
                  {isReached(c) ? <CallIcon className="w-4 h-4 text-zinc-300" live={live} /> : <MissedCallIcon className="w-4 h-4 text-zinc-500" />}
                </span>
                <p className="text-[13px] text-zinc-400 tabular-nums">
                  {new Date(c.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                  {isReached(c) ? ` · ${formatDuration(c.seconds)}${c.language ? ` · ${c.language}` : ""}` : " · no answer"}
                </p>
                {c.summary && isReached(c) && <p className="mt-1 text-[14px] leading-6 text-zinc-200 max-w-[62ch]">{c.summary}</p>}
              </li>
            ))}
          </ol>
        </section>
      ),
    });
  }

  if (r.heard.length) {
    sections.push({
      id: "report-heard",
      name: "What we heard",
      node: (
        <section>
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 mb-3 text-[13px] font-medium text-zinc-500">
            <span>What we heard</span>
            <span>What you can do</span>
          </div>
          <div className="divide-y divide-ay-line border-y border-ay-line">
            {r.heard.map((h) => (
              <div key={h.at} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 py-3.5 text-[14px] leading-6">
                <div className="min-w-0">
                  <p className="text-[12px] text-zinc-600 mb-0.5">{kind === "day" ? "" : shortDate(new Date(Date.parse(h.at) + 19_800_000).toISOString().slice(0, 10))}</p>
                  <p className="text-zinc-200">{h.what}</p>
                </div>
                <p className={h.todo === "Nothing needed." ? "text-zinc-500 self-end" : "text-[#FEE5A5] self-end"}>{h.todo}</p>
              </div>
            ))}
          </div>
        </section>
      ),
    });
  }

  if (r.quotes.length || r.next.length) {
    sections.push({
      id: "report-words",
      name: "In her words",
      node: (
        <section className="grid gap-8 sm:grid-cols-2">
          {r.quotes.length > 0 && (
            <div>
              <Heading>In {w.hers} words</Heading>
              <div className="space-y-4">
                {r.quotes.map((q) => (
                  <blockquote key={q.date + q.words} className="flex gap-3">
                    <WordsIcon className="w-5 h-5 shrink-0 mt-1 text-zinc-300" />
                    <div className="min-w-0">
                      <p className="text-[17px] leading-snug text-white">“{q.words}”</p>
                      <p className="mt-1 text-[12px] text-zinc-500">{shortDate(q.date)}</p>
                    </div>
                  </blockquote>
                ))}
              </div>
            </div>
          )}
          {r.next.length > 0 && (
            <div>
              <Heading>{kind === "day" ? "Next call Anyash will ask" : kind === "week" ? "Next week Anyash will ask" : "Anyash keeps following"}</Heading>
              <ul className="space-y-3">
                {r.next.map((t) => (
                  <li key={t.title} className="flex gap-3 text-[14px] text-zinc-200">
                    <PinIcon className="w-5 h-5 shrink-0 text-zinc-300" />
                    {t.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ),
    });
  }

  sections.push({
    id: "report-foot",
    name: "Footnote",
    node: (
      <p className="text-[12px] text-zinc-600">
        Based on {r.conversations} {r.conversations === 1 ? "conversation" : "conversations"} with {name} {kind === "day" ? "today" : kind === "week" ? "this week" : "this month"}. Anyash is not a doctor.
      </p>
    ),
  });
  return sections;
}

/* ------------------------------------------------------------------ */
/* Present mode                                                        */
/* ------------------------------------------------------------------ */

function PresentStage({
  build,
  context,
  onExit,
}: {
  build: (opts: { private: boolean }) => StorySection[];
  context: string;
  onExit: () => void;
}) {
  const [i, setI] = useState(0);
  const [priv, setPriv] = useState(true);
  const [zoom, setZoom] = useState(1);
  const sections = build({ private: priv });
  const n = sections.length;
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(n - 1, x + d))), [n]);

  useEffect(() => {
    const fit = () => setZoom(Math.max(1, Math.min(1.7, (window.innerWidth - 64) / 860)));
    fit();
    window.addEventListener("resize", fit);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onExit]);

  const current = sections[Math.min(i, n - 1)];
  return (
    <div className="fixed inset-0 z-[80] bg-ay-canvas text-zinc-300 flex flex-col ay-present" role="dialog" aria-modal="true" aria-label="Present">
      <div className="flex items-center justify-between gap-3 px-5 sm:px-8 pt-[max(env(safe-area-inset-top),16px)] pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[16px] font-semibold text-white tracking-tight">Anyash</span>
          <span className="hidden sm:inline text-[11px] uppercase tracking-[0.14em] text-[#FEE5A5]/80">Behind the scenes</span>
        </div>
        <p className="text-[13px] text-zinc-400 truncate">{context}</p>
      </div>
      <div
        className="flex-1 overflow-y-auto"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, a")) return;
          go(1);
        }}
      >
        <div className="mx-auto max-w-[860px] px-5 sm:px-8 py-6 sm:py-10" style={{ zoom }}>
          <div key={`${current.id}-${priv}`} className="ay-slide">
            {current.node}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-5 sm:px-8 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] border-t border-white/[0.06]">
        <button onClick={() => setPriv((v) => !v)} className="inline-flex items-center gap-2 h-10 px-3 rounded-full text-[13px] text-zinc-400 hover:text-white hover:bg-white/5" aria-pressed={priv}>
          {priv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {priv ? "Full name hidden" : "Full name shown"}
        </button>
        <div className="hidden sm:flex items-center gap-1.5" aria-label={`Section ${i + 1} of ${n}`}>
          {sections.map((s, j) => (
            <button key={s.id} onClick={() => setI(j)} title={s.name} aria-label={s.name} className={`h-2 rounded-full transition-all ${j === i ? "w-7 bg-[#FEE5A5]" : "w-2 bg-zinc-700 hover:bg-zinc-500"}`} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => go(-1)} disabled={i === 0} className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:bg-white/5 disabled:opacity-30" aria-label="Previous">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Button variant="primary" onClick={() => (i === n - 1 ? onExit() : go(1))} className="h-10 px-5">
            {i === n - 1 ? "Done" : "Next"}
          </Button>
          <button onClick={onExit} className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 hover:bg-white/5" aria-label="Exit present mode">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PresentButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick} icon={<Play className="w-3.5 h-3.5" />}>
      Present
    </Button>
  );
}

function displayName(fullName: string, honorific: string | undefined, priv: boolean) {
  if (!priv) return fullName;
  return honorific?.trim() || fullName.split(" ")[0];
}

function SarvamNotice({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mb-6 text-[12.5px] text-amber-200/90">Sarvam calls couldn't load ({error}). Showing what Supabase has.</p>;
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

export function SummaryTab({ parentId, parentName }: { parentId: string; parentName: string }) {
  const { q, story, meta, sarvamError } = useStoryData(parentId);
  const [presenting, setPresenting] = useState(false);
  const honorific = meta?.honorific;
  return (
    <StoryState q={q} story={story}>
      {story && (
        <div className="pt-8">
          <div className="flex justify-end -mb-6">
            <PresentButton onClick={() => setPresenting(true)} />
          </div>
          <SarvamNotice error={sarvamError} />
          <div className="space-y-12">
            {summarySections(story, { live: false, name: parentName }).map((s) => (
              <div key={s.id}>{s.node}</div>
            ))}
          </div>
          {presenting && (
            <PresentStage
              context={`${displayName(parentName, honorific, true)} · Day ${story.dayNumber} with Anyash`}
              build={({ private: priv }) => summarySections(story, { live: true, name: displayName(parentName, honorific, priv) })}
              onExit={() => setPresenting(false)}
            />
          )}
        </div>
      )}
    </StoryState>
  );
}

export function ReportTab({ parentId, parentName }: { parentId: string; parentName: string }) {
  const { q, story, meta, sarvamError } = useStoryData(parentId);
  const [kind, setKind] = useState<PeriodKind>("week");
  const [anchor, setAnchor] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const honorific = meta?.honorific;
  const today = story?.today;
  const at = anchor || today || "";

  const step = (dir: number) => {
    if (!story) return;
    let next = at;
    if (kind === "day") next = addDays(at, dir);
    else if (kind === "week") next = addDays(at, dir * 7);
    else {
      const d = new Date(`${at.slice(0, 8)}01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + dir);
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      next = end > story.today ? story.today : end;
    }
    if (next > story.today) next = story.today;
    if (next < story.start) return;
    setAnchor(next === story.today ? null : next);
  };

  return (
    <StoryState q={q} story={story}>
      {story && today && (
        <div className="pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3">
              <Segmented
                options={[
                  { id: "day" as PeriodKind, label: "Day" },
                  { id: "week" as PeriodKind, label: "Week" },
                  { id: "month" as PeriodKind, label: "Month" },
                ]}
                value={kind}
                onChange={(k) => {
                  setKind(k);
                  setAnchor(null);
                }}
              />
              <div className="flex items-center">
                <button onClick={() => step(-1)} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5" aria-label="Earlier">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => step(1)} disabled={at >= today} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30" aria-label="Later">
                  <ChevronRight className="w-4 h-4" />
                </button>
                {anchor && (
                  <button onClick={() => setAnchor(null)} className="ml-1 text-[12.5px] text-zinc-400 hover:text-white">
                    Back to today
                  </button>
                )}
              </div>
            </div>
            <PresentButton onClick={() => setPresenting(true)} />
          </div>
          <SarvamNotice error={sarvamError} />
          <div className="space-y-12">
            {reportSections(story, kind, at, { live: false, name: parentName }).map((s) => (
              <div key={s.id}>{s.node}</div>
            ))}
          </div>
          {presenting && (
            <PresentStage
              context={`${displayName(parentName, honorific, true)} · ${buildReport(story, kind, at).period.context}`}
              build={({ private: priv }) => reportSections(story, kind, at, { live: true, name: displayName(parentName, honorific, priv) })}
              onExit={() => setPresenting(false)}
            />
          )}
        </div>
      )}
    </StoryState>
  );
}
