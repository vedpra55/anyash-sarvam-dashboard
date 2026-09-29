"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCw, Search } from "lucide-react";
import { CallDetailDrawer } from "@/components/anyash/CallDetailDrawer";
import { EmptyState, IconButton, Segmented, Button } from "@/components/anyash/primitives";
import { CallsSkeleton } from "@/components/anyash/Skeletons";
import { useCallsQuery, prefetchCall } from "@/lib/queries";
import { Dot, StatusLabel, callStatusMeta, decisionMeta, formatDuration, formatRelative, humanize } from "@/components/anyash/detail-ui";
import { isConnected } from "@/lib/attention";

interface CallItem {
  id: string;
  attempt_id: string;
  interaction_id?: string;
  parent_name: string;
  parent_phone: string;
  child_name?: string;
  call_status: string;
  duration_seconds: number;
  call_outcome?: string;
  call_summary?: string;
  health_update?: string;
  follow_up_detail?: string;
  follow_up_needed?: string;
  parent_mood?: string;
  created_at: string;
  language_name?: string;
  num_messages?: number;
  has_recording?: boolean;
  ai_decision?: string;
  ai_urgency?: string;
}

type Filter = "all" | "attention" | "not_reached";

function needsAttention(c: CallItem) {
  const d = (c.ai_decision || "").toUpperCase();
  return (
    c.follow_up_needed === "yes" ||
    d === "ESCALATION" ||
    d === "FAMILY_NOTIFICATION" ||
    c.ai_urgency === "urgent" ||
    c.ai_urgency === "medium"
  );
}

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
}

export default function CallsPage() {
  const queryClient = useQueryClient();
  const callsQuery = useCallsQuery();
  const calls = (callsQuery.data || []) as CallItem[];
  const isLoading = callsQuery.isPending;
  const isRefreshing = callsQuery.isFetching && !callsQuery.isPending;
  const error = callsQuery.isError && !callsQuery.data ? callsQuery.error.message : "";
  const refreshError = callsQuery.isError && callsQuery.data ? callsQuery.error.message : "";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedCall, setSelectedCall] = useState<CallItem | null>(null);

  // Re-render the "updated … ago" label every 30 seconds.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(
    () => ({
      all: calls.length,
      attention: calls.filter(needsAttention).length,
      not_reached: calls.filter((c) => !isConnected(c)).length,
    }),
    [calls]
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = calls.filter((c) => {
      if (filter === "attention" && !needsAttention(c)) return false;
      if (filter === "not_reached" && isConnected(c)) return false;
      if (!q) return true;
      return (
        (c.parent_name || "").toLowerCase().includes(q) ||
        (c.parent_phone || "").includes(q) ||
        (c.call_summary || "").toLowerCase().includes(q)
      );
    });
    const byDay = new Map<string, { label: string; calls: CallItem[] }>();
    for (const c of filtered) {
      const d = new Date(c.created_at);
      const key = d.toDateString();
      if (!byDay.has(key)) byDay.set(key, { label: dayLabel(d), calls: [] });
      byDay.get(key)!.calls.push(c);
    }
    return Array.from(byDay.values());
  }, [calls, query, filter]);

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1080px] mx-auto px-5 sm:px-10 py-8 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-[26px] font-semibold text-white tracking-tight">
              Calls
              {calls.length > 0 && <span className="ml-2 text-[15px] font-normal text-zinc-600 tabular-nums">{calls.length}</span>}
            </h1>
            <div className="flex items-center gap-2">
              {callsQuery.dataUpdatedAt > 0 && (
                <span className="hidden sm:inline text-[12px] text-zinc-600">
                  {isRefreshing ? "Refreshing…" : `Updated ${formatRelative(new Date(callsQuery.dataUpdatedAt).toISOString())}`}
                </span>
              )}
              <IconButton label="Refresh" onClick={() => callsQuery.refetch()} disabled={isRefreshing}>
                <RotateCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </IconButton>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: "All", count: counts.all },
                { id: "attention", label: "Needs attention", count: counts.attention },
                { id: "not_reached", label: "Not reached", count: counts.not_reached },
              ]}
            />
            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone or summary"
                aria-label="Search calls"
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.04] outline-none focus:ring-1 focus:ring-ay-accent/50 text-[13px] text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
          </div>

          {refreshError && (
            <p className="mt-4 text-[12.5px] text-amber-200/80">Couldn&apos;t refresh just now; showing the last loaded calls.</p>
          )}

          {isLoading ? (
            <div className="mt-6">
              <CallsSkeleton />
            </div>
          ) : error ? (
            <EmptyState title="Couldn't load calls." action={<Button size="sm" onClick={() => callsQuery.refetch()}>Try again</Button>}>
              {error}
            </EmptyState>
          ) : groups.length === 0 ? (
            <EmptyState
              title={calls.length === 0 ? "No calls yet." : "No calls match."}
              action={
                calls.length > 0 && (filter !== "all" || query) ? (
                  <Button size="sm" onClick={() => { setFilter("all"); setQuery(""); }}>Show all calls</Button>
                ) : undefined
              }
            >
              {calls.length === 0 ? "Calls placed from the Parents page show up here." : undefined}
            </EmptyState>
          ) : (
            <div className="mt-6">
              {groups.map((group) => (
                <section key={group.label} className="pt-6">
                  <h2 className="text-[13px] font-medium text-zinc-500 pb-2 border-b border-ay-line">
                    {group.label}
                    <span className="ml-2 text-zinc-600 tabular-nums">{group.calls.length}</span>
                  </h2>
                  <ul className="divide-y divide-ay-line">
                    {group.calls.map((call) => {
                      const status = callStatusMeta(call.call_status);
                      const connected = isConnected(call);
                      const verdict = call.ai_decision || call.ai_urgency ? decisionMeta(call.ai_decision, call.ai_urgency) : null;
                      const summary = connected
                        ? call.call_summary || humanize(call.call_outcome) || "Check-in completed."
                        : status.label;
                      return (
                        <li key={call.id}>
                          <button
                            onClick={() => setSelectedCall(call)}
                            onMouseEnter={() => prefetchCall(queryClient, call)}
                            onFocus={() => prefetchCall(queryClient, call)}
                            className={`w-full text-left grid grid-cols-[56px_1fr] md:grid-cols-[64px_180px_1fr_64px_150px] gap-x-4 gap-y-1 py-3.5 items-baseline transition-colors hover:bg-white/[0.02] -mx-2 px-2 rounded-md ${
                              selectedCall?.id === call.id ? "bg-white/[0.04]" : ""
                            }`}
                          >
                            <span className="text-[13px] text-zinc-500 tabular-nums">
                              {new Date(call.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            </span>
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Dot tone={status.tone} />
                              <span className="text-[14px] text-zinc-100 truncate">{call.parent_name || "Parent"}</span>
                            </span>
                            <span className={`col-start-2 md:col-start-auto text-[13px] truncate ${connected ? "text-zinc-400" : "text-zinc-500"}`}>
                              {summary}
                            </span>
                            <span className="hidden md:block text-[13px] text-zinc-500 tabular-nums text-right">
                              {call.duration_seconds > 0 ? formatDuration(call.duration_seconds) : "—"}
                            </span>
                            <span className="col-start-2 md:col-start-auto text-[12.5px]">
                              {verdict ? <StatusLabel tone={verdict.tone}>{verdict.label}</StatusLabel> : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <CallDetailDrawer call={selectedCall as any} onClose={() => setSelectedCall(null)} />
    </>
  );
}
