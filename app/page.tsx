"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Phone, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/anyash/Sidebar";
import { ParentItem } from "@/components/anyash/ParentsListColumn";
import { useParents } from "@/components/anyash/useParents";
import { useParentActions } from "@/components/anyash/useParentActions";
import { Button, EmptyState, LoadingText } from "@/components/anyash/primitives";
import { Dot, humanize } from "@/components/anyash/detail-ui";
import { getParentStatus, isConnected, ParentStatus } from "@/lib/attention";

function timeOf(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function todaysCall(parent: ParentItem) {
  const today = new Date().toDateString();
  const calls = (parent.calls || []).filter((c) => c.created_at && new Date(c.created_at).toDateString() === today);
  return calls.find(isConnected) || calls[0] || null;
}

function Heading({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="text-[13px] font-medium text-zinc-500 mb-2">
      {title}
      {count !== undefined && <span className="ml-2 tabular-nums text-zinc-600">{count}</span>}
    </h2>
  );
}

function AttentionRow({
  parent,
  status,
  onCall,
  onDone,
  busy,
}: {
  parent: ParentItem;
  status: ParentStatus;
  onCall: () => void;
  onDone?: () => void;
  busy: boolean;
}) {
  return (
    <li className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <Dot tone={status.tone} />
          <Link href={`/parents?id=${parent.id}`} className="text-[14px] font-medium text-white hover:underline underline-offset-4 decoration-zinc-600">
            {parent.parent_name}
          </Link>
          <span className="text-[13px] text-zinc-400">{status.label}</span>
        </div>
        {status.reason && <p className="mt-1 pl-4 text-[13px] text-zinc-500 leading-6">{status.reason}</p>}
      </div>
      <div className="flex items-center gap-2 pl-4 sm:pl-0 shrink-0">
        {onDone && (
          <Button size="sm" variant="ghost" onClick={onDone} disabled={busy}>
            Mark done
          </Button>
        )}
        <Button size="sm" onClick={onCall} icon={<Phone className="w-3.5 h-3.5" />}>
          Call
        </Button>
      </div>
    </li>
  );
}

export default function TodayPage() {
  const { parents, loading, error, reload } = useParents();
  const actions = useParentActions({ onChanged: reload });
  const [markingId, setMarkingId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const now = new Date();
    return parents
      .map((p) => ({ parent: p, status: getParentStatus(p, now) }))
      .sort((a, b) => a.status.rank - b.status.rank || a.parent.parent_name.localeCompare(b.parent.parent_name));
  }, [parents]);

  const attention = rows.filter((r) => r.status.needsAttention);
  const checkedIn = rows.filter((r) => r.status.today === "done").length;
  const callsToday = parents.reduce(
    (n, p) => n + (p.calls || []).filter((c) => c.created_at && new Date(c.created_at).toDateString() === new Date().toDateString()).length,
    0
  );

  const markDone = async (cardId: string) => {
    setMarkingId(cardId);
    try {
      const res = await fetch(`/api/decisions/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_completed: true }),
      });
      if (res.ok) await reload();
    } finally {
      setMarkingId(null);
    }
  };

  const dateLabel = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[880px] mx-auto px-5 sm:px-10 py-8 sm:py-12">
          <p className="text-[13px] text-zinc-500">{dateLabel}</p>
          <h1 className="text-[26px] font-semibold text-white tracking-tight mt-1">Today</h1>

          {loading ? (
            <LoadingText />
          ) : error ? (
            <EmptyState title="Couldn't load today's data." action={<Button size="sm" onClick={reload}>Try again</Button>}>
              {error}
            </EmptyState>
          ) : parents.length === 0 ? (
            <EmptyState
              title="No parents yet."
              action={<Button variant="primary" onClick={actions.openAdd}>Add a parent</Button>}
            >
              Add a parent and Anya will start daily check-in calls.
            </EmptyState>
          ) : (
            <>
              <p className="mt-3 text-[14px] text-zinc-400">
                <span className="text-white tabular-nums">{checkedIn}</span> of {parents.length} checked in
                <span className="text-zinc-700 mx-2">·</span>
                <span className="text-white tabular-nums">{callsToday}</span> {callsToday === 1 ? "call" : "calls"} placed
                <span className="text-zinc-700 mx-2">·</span>
                <span className={attention.length ? "text-ay-accent-ink tabular-nums" : "text-white tabular-nums"}>{attention.length}</span>{" "}
                {attention.length === 1 ? "needs" : "need"} attention
              </p>

              <section className="mt-10">
                <Heading title="Needs attention" count={attention.length} />
                {attention.length === 0 ? (
                  <p className="py-4 text-[14px] text-zinc-400 border-t border-ay-line">
                    Nothing needs you right now.
                  </p>
                ) : (
                  <ul className="divide-y divide-ay-line border-t border-ay-line">
                    {attention.map(({ parent, status }) => (
                      <AttentionRow
                        key={parent.id}
                        parent={parent}
                        status={status}
                        busy={markingId === status.cardId}
                        onCall={() => actions.openCall(parent)}
                        onDone={status.cardId ? () => markDone(status.cardId!) : undefined}
                      />
                    ))}
                  </ul>
                )}
              </section>

              <section className="mt-12">
                <Heading title="Today's check-ins" />
                <ul className="divide-y divide-ay-line border-t border-ay-line">
                  {rows.map(({ parent, status }) => {
                    const call = todaysCall(parent);
                    const state =
                      status.today === "done"
                        ? `Checked in ${timeOf(call?.created_at)}`
                        : status.today === "not_reached"
                        ? `Not reached · tried ${timeOf(call?.created_at)}`
                        : "Not called yet";
                    const line =
                      status.today === "done"
                        ? call?.call_summary || humanize(call?.call_outcome) || ""
                        : status.today === "not_reached"
                        ? humanize(call?.call_status)
                        : status.watchItem
                        ? `Anya will ask: ${status.watchItem}`
                        : "";
                    return (
                      <li key={parent.id} className="flex items-center gap-4 py-3.5">
                        <Link href={`/parents?id=${parent.id}`} className="min-w-0 flex-1 group">
                          <div className="flex items-baseline gap-3">
                            <span className="text-[14px] text-zinc-100 group-hover:text-white">{parent.parent_name}</span>
                            <span
                              className={`text-[12.5px] ${
                                status.today === "done" ? "text-emerald-300/90" : status.today === "not_reached" ? "text-amber-200" : "text-zinc-500"
                              }`}
                            >
                              {state}
                            </span>
                          </div>
                          {line && <p className="text-[13px] text-zinc-500 truncate mt-0.5">{line}</p>}
                        </Link>
                        {status.today === "done" ? (
                          <Link href={`/parents?id=${parent.id}`} aria-label={`Open ${parent.parent_name}`} className="text-zinc-600 hover:text-zinc-300">
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => actions.openCall(parent)} icon={<Phone className="w-3.5 h-3.5" />}>
                            Call
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
      {actions.ui}
    </AppShell>
  );
}
