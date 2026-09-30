"use client";

import React, { use, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { fetchJson } from "@/lib/queries";
import { Button, EmptyState, LoadingText, Segmented } from "@/components/anyash/primitives";
import { Callout, Dot, formatDateTime, formatDuration, humanize, Tone } from "@/components/anyash/detail-ui";

interface MemoryV2 {
  parent: { id: string; parent_name: string; honorific?: string; number_of_calls: number; current_user_context?: string };
  mode: "shadow" | "live" | "off";
  briefs: {
    id: string;
    call_number: number;
    brief_text: string;
    mode: "shadow" | "live" | "example";
    used_in_call: boolean;
    attempt_id: string | null;
    sent_user_context: string | null;
    checks: { words?: number; missing_threads?: string[]; attempts?: number; appended?: boolean } | null;
    created_at: string;
    call: {
      call_status: string;
      duration_seconds: number | null;
      call_summary: string | null;
      previous_user_context: string | null;
      created_at: string;
    } | null;
  }[];
  facts: {
    id: string;
    block: string;
    key: string;
    value: string;
    source: "child" | "parent";
    confirmed: boolean;
    valid_from: string;
    valid_to: string | null;
  }[];
  threads: {
    id: string;
    title: string;
    kind: "health" | "life";
    status: "open" | "closed";
    importance: number;
    opened_on: string;
    last_mentioned_call: number;
    next_ask_call: number | null;
    last_words: string | null;
    closed_reason: string | null;
  }[];
  reflections: { id: string; calls_covered: number[]; patterns: { pattern: string; event_ids: string[] }[]; created_at: string }[];
  events: { id: string; call_number: number | null; call_date: string; category: string; parent_words: string; summary: string; importance: number }[];
}

const BLOCKS = ["person", "household", "routine", "health", "likes", "sensitivities"];

const MODE_COPY: Record<MemoryV2["mode"], string> = {
  shadow: "Shadow: briefs are built and saved, the old memory is still sent to the agent.",
  live: "Live: the brief is sent to the agent as user_context.",
  off: "Off: no briefs are built.",
};

const words = (s?: string | null) => (s ? s.split(/\s+/).filter(Boolean).length : 0);
const importanceTone = (n: number): Tone => (n >= 5 ? "urgent" : n >= 4 ? "notify" : n >= 3 ? "watch" : "neutral");

function Heading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-4 mt-12">
      <h2 className="text-[13px] font-medium text-zinc-500">{children}</h2>
      {aside}
    </div>
  );
}

function TextPanel({ label, text, note }: { label: string; text?: string | null; note?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="text-[12.5px] text-zinc-400">{label}</div>
        {text ? <div className="text-[12px] text-zinc-600 tabular-nums">{words(text)} words</div> : null}
      </div>
      {text ? (
        <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-zinc-200 bg-white/[0.03] rounded-lg p-4">
          {text}
        </pre>
      ) : (
        <div className="text-[13px] text-zinc-600 bg-white/[0.02] rounded-lg p-4">{note || "Nothing recorded."}</div>
      )}
    </div>
  );
}

function BriefRow({ b, oldMemory }: { b: MemoryV2["briefs"][number]; oldMemory?: string }) {
  const sentBrief = b.mode === "live" && b.used_in_call;
  // The old memory at the time: what was sent (shadow), else what the call started from.
  const old = sentBrief ? b.call?.previous_user_context || oldMemory : b.sent_user_context || b.call?.previous_user_context || oldMemory;
  const missing = b.checks?.missing_threads || [];
  return (
    <div className="py-6 border-t border-white/[0.06] first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
        <span className="text-white font-medium">Call {b.call_number}</span>
        <span className="text-zinc-500">{humanize(b.mode)}</span>
        <span className="text-zinc-600">{formatDateTime(b.created_at)}</span>
        {b.call && (
          <span className="text-zinc-500">
            {humanize(b.call.call_status)}
            {b.call.duration_seconds ? ` · ${formatDuration(b.call.duration_seconds)}` : ""}
          </span>
        )}
        {b.checks?.appended && <span className="text-amber-200">threads appended by the check</span>}
        {missing.length > 0 && <span className="text-rose-300">missing: {missing.join(", ")}</span>}
      </div>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TextPanel
          label={sentBrief ? "Old memory (not sent)" : b.mode === "example" ? "Old memory (now)" : "Old memory (sent)"}
          text={old}
          note={b.mode === "example" ? "No call placed with this brief." : "The call's context wasn't recorded."}
        />
        <TextPanel label={b.used_in_call ? "New brief (sent)" : "New brief (saved, not sent)"} text={b.brief_text} />
      </div>
      {b.call?.call_summary && (
        <p className="mt-3 text-[12.5px] text-zinc-500 leading-5">
          <span className="text-zinc-400">What happened on the call: </span>
          {b.call.call_summary}
        </p>
      )}
    </div>
  );
}

export default function MemoryPage({ params }: { params: Promise<{ parentId: string }> }) {
  const { parentId } = use(params);
  const [factView, setFactView] = useState<"current" | "history">("current");
  const query = useQuery({
    queryKey: ["memory-v2", parentId],
    queryFn: () => fetchJson<MemoryV2>(`/api/memory/${encodeURIComponent(parentId)}`),
    refetchInterval: 60_000,
  });
  const data = query.data;

  const factsByBlock = useMemo(() => {
    const rows = (data?.facts || []).filter((f) => (factView === "current" ? f.valid_to === null : true));
    return BLOCKS.map((block) => ({ block, rows: rows.filter((f) => f.block === block) })).filter((g) => g.rows.length);
  }, [data, factView]);

  const eventsByCall = useMemo(() => {
    const groups = new Map<string, MemoryV2["events"]>();
    for (const e of data?.events || []) {
      const k = `${e.call_number ?? "?"}|${e.call_date}`;
      groups.set(k, [...(groups.get(k) || []), e]);
    }
    return Array.from(groups.entries());
  }, [data]);

  const openThreads = (data?.threads || []).filter((t) => t.status === "open");
  const closedThreads = (data?.threads || []).filter((t) => t.status === "closed");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1080px] mx-auto px-5 sm:px-10 py-8 sm:py-12">
        <Link href="/parents" className="inline-flex items-center gap-1.5 text-[12.5px] text-zinc-500 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" /> Parents
        </Link>

        {query.isPending ? (
          <div className="mt-10">
            <LoadingText>Loading memory…</LoadingText>
          </div>
        ) : query.isError || !data ? (
          <EmptyState title="Couldn't load memory." action={<Button size="sm" onClick={() => query.refetch()}>Try again</Button>}>
            {query.error?.message}
          </EmptyState>
        ) : (
          <>
            <div className="mt-4">
              <h1 className="text-[26px] font-semibold text-white tracking-tight">{data.parent.parent_name}: memory</h1>
              <p className="mt-1 text-[13px] text-zinc-500">
                Next call is #{data.parent.number_of_calls}
                <span className="text-zinc-700 mx-2">·</span>
                {openThreads.length} open {openThreads.length === 1 ? "thread" : "threads"}
                <span className="text-zinc-700 mx-2">·</span>
                {data.events.length} events
              </p>
              <div className="mt-4">
                <Callout tone={data.mode === "live" ? "good" : "watch"} title={`Brief mode: ${data.mode}`}>
                  {MODE_COPY[data.mode]}
                </Callout>
              </div>
            </div>

            <Heading>Old memory and new brief, per call</Heading>
            {data.briefs.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No briefs yet. One is built before each call.</p>
            ) : (
              data.briefs.map((b) => <BriefRow key={b.id} b={b} oldMemory={data.parent.current_user_context} />)
            )}

            <Heading>Threads</Heading>
            {openThreads.length === 0 && closedThreads.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No threads yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {[...openThreads, ...closedThreads].map((t) => (
                  <li key={t.id} className={`py-3 text-[13px] ${t.status === "closed" ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Dot tone={importanceTone(t.importance)} />
                      <span className="text-zinc-100">{t.title}</span>
                      <span className="text-zinc-500">{humanize(t.kind)}</span>
                      <span className="text-zinc-600">
                        {t.status === "open"
                          ? `ask on call ${t.next_ask_call ?? "—"} · last talked about on call ${t.last_mentioned_call}`
                          : `closed (${t.closed_reason}) · last on call ${t.last_mentioned_call}`}
                      </span>
                    </div>
                    {t.last_words && <div className="mt-1 pl-4 text-zinc-400">“{t.last_words}”</div>}
                  </li>
                ))}
              </ul>
            )}

            <Heading
              aside={
                <Segmented
                  value={factView}
                  onChange={setFactView}
                  options={[
                    { id: "current", label: "Current" },
                    { id: "history", label: "With history" },
                  ]}
                />
              }
            >
              Living profile
            </Heading>
            {factsByBlock.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No facts yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                {factsByBlock.map(({ block, rows }) => (
                  <div key={block}>
                    <div className="text-[12.5px] text-zinc-400 mb-1">{humanize(block)}</div>
                    <dl>
                      {rows.map((f) => (
                        <div key={f.id} className={`grid grid-cols-[140px_1fr] gap-4 py-1.5 text-[13px] ${f.valid_to ? "opacity-50" : ""}`}>
                          <dt className="text-zinc-500 break-words">{humanize(f.key)}</dt>
                          <dd className="text-zinc-200 min-w-0 break-words">
                            {f.value}
                            <span className="ml-2 text-[12px] text-zinc-600">
                              {f.source === "parent" ? "said by parent" : "family says"}
                              {f.valid_to ? ` · until ${f.valid_to}` : ` · since ${f.valid_from}`}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}

            <Heading>Reflections</Heading>
            {data.reflections.length === 0 ? (
              <p className="text-[13px] text-zinc-500">Written after every 5th real call.</p>
            ) : (
              data.reflections.map((r) => (
                <div key={r.id} className="mb-4">
                  <div className="text-[12.5px] text-zinc-500 mb-1">Calls {r.calls_covered.join(", ")}</div>
                  <ul className="list-disc pl-5 text-[13px] text-zinc-200 space-y-1">
                    {r.patterns.map((p, i) => (
                      <li key={i}>
                        {p.pattern} <span className="text-zinc-600">({p.event_ids.length} events)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}

            <Heading>Events</Heading>
            {eventsByCall.length === 0 ? (
              <p className="text-[13px] text-zinc-500">Nothing recorded from calls yet.</p>
            ) : (
              eventsByCall.map(([key, events]) => {
                const [call, date] = key.split("|");
                return (
                  <div key={key} className="mb-6">
                    <div className="text-[12.5px] text-zinc-400 mb-1">
                      Call {call} · {date}
                    </div>
                    <ul className="divide-y divide-white/[0.04]">
                      {events.map((e) => (
                        <li key={e.id} className="py-2 grid grid-cols-[80px_1fr] gap-4 text-[13px]">
                          <span className="inline-flex items-center gap-2 text-zinc-500">
                            <Dot tone={importanceTone(e.importance)} />
                            {e.category}
                          </span>
                          <span className="min-w-0">
                            <span className="text-zinc-200">{e.summary}</span>
                            <span className="block text-zinc-500">“{e.parent_words}”</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
