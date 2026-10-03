"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { ParentItem } from "./ParentsListColumn";
import { CallDetailDrawer, AudioPlayer } from "./CallDetailDrawer";
import { MemoryPanel } from "./MemoryPanel";
import { ProgressiveMemory } from "./ProgressiveMemory";
import { TrendStrip } from "./TrendStrip";
import { SummaryTab, ReportTab } from "./story/StoryTabs";
import { Button, TabBar, EmptyState } from "./primitives";
import {
  Section,
  Field,
  StatusLabel,
  callStatusMeta,
  humanize,
  formatDuration,
  formatDateTime,
  formatRelative,
} from "./detail-ui";
import { getParentStatus, isConnected } from "@/lib/attention";
import { parseMemory } from "@/lib/memory";
import { formatPhone } from "@/lib/languages";
import { readOnboarding, LIVING_SITUATIONS } from "@/lib/onboarding";
import { parseClock, formatClock } from "@/lib/callTime";
import { SarvamCallRecord } from "@/lib/sarvam";
import { useMarkDone, prefetchCall, memoryQuery } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";

export type DetailSubTab = "summary" | "report" | "overview" | "calls" | "memory" | "profile";

interface ParentDetailCanvasProps {
  parent: ParentItem | null;
  onCallNow: (parent: ParentItem) => void;
  onEditClick: (parent: ParentItem) => void;
  isCalling?: boolean;
  backHref?: string;
}

function clockLabel(value?: string | null): string | null {
  const minutes = parseClock(value);
  return minutes === null ? null : formatClock(minutes);
}

function CallTimingSection({ parent, onEdit }: { parent: ParentItem; onEdit: () => void }) {
  return (
    <Section title="Call timing" aside={
      <button onClick={onEdit} className="text-[12.5px] text-zinc-400 hover:text-white">Edit</button>
    }>
      <dl>
        <Field label="Best time to call">{clockLabel(parent.preferred_call_time) || <span className="text-zinc-500">Not set</span>}</Field>
        <Field label="Usually sleeps at">{clockLabel(parent.sleep_time) || <span className="text-zinc-500">Not set</span>}</Field>
      </dl>
    </Section>
  );
}

/** Marks answers the child gave that the parent has not confirmed yet. */
function FromChildTag({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[12px] text-zinc-500">From the family, not yet confirmed</span>;
}

function CallRow({ call, onOpen, onIntent }: { call: any; onOpen: () => void; onIntent: () => void }) {
  const status = callStatusMeta(call.call_status);
  const when = new Date(call.created_at);
  return (
    <li>
      <button onClick={onOpen} onMouseEnter={onIntent} onFocus={onIntent} className="w-full grid grid-cols-[112px_1fr_16px] sm:grid-cols-[140px_1fr_16px] gap-x-4 sm:gap-x-6 py-4 text-left group">
        <div>
          <div className="text-[13px] text-zinc-200">
            {when.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
          </div>
          <div className="text-[12px] text-zinc-500 mt-0.5 tabular-nums">
            {when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            {call.duration_seconds > 0 ? ` · ${formatDuration(call.duration_seconds)}` : ""}
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3 text-[12px] flex-wrap">
            <StatusLabel tone={status.tone}>{status.label}</StatusLabel>
            {call.call_outcome && <span className="text-zinc-500">{humanize(call.call_outcome)}</span>}
            {call.follow_up_needed === "yes" && <StatusLabel tone="watch">Follow-up</StatusLabel>}
          </div>
          <p className="text-[13px] text-zinc-400 group-hover:text-zinc-200 leading-6 mt-1 line-clamp-2 transition-colors">
            {call.call_summary || call.health_update || (isConnected(call) ? "Check-in completed." : "No conversation.")}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-300 transition-colors self-center" />
      </button>
    </li>
  );
}

export function ParentDetailCanvas({
  parent,
  onCallNow,
  onEditClick,
  isCalling = false,
  backHref,
}: ParentDetailCanvasProps) {
  const [activeTab, setActiveTab] = useState<DetailSubTab>("overview");
  const [drawerCall, setDrawerCall] = useState<SarvamCallRecord | null>(null);
  const markDoneMutation = useMarkDone();
  const queryClient = useQueryClient();

  useEffect(() => {
    setActiveTab("overview");
    setDrawerCall(null);
    // Warm the Memory tab so opening it is instant.
    if (parent?.id) queryClient.prefetchQuery(memoryQuery(parent.id));
  }, [parent?.id, queryClient]);

  const status = useMemo(() => (parent ? getParentStatus(parent) : null), [parent]);
  const watchlist = useMemo(() => parseMemory(parent?.current_user_context).watchlist, [parent?.current_user_context]);

  if (!parent || !status) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <EmptyState title="Select a parent">Their latest check-in, trends and Anya&apos;s memory appear here.</EmptyState>
      </div>
    );
  }

  const firstName = parent.parent_name.split(" ")[0];
  const calls = parent.calls || [];
  const lastConnected = calls.find(isConnected) || null;
  const review = parent.reviews?.[0];
  const nextStep = review?.next_action || review?.ai_recommended_action || "";
  const profile = readOnboarding(parent);
  const child = profile.child_name;
  const relation = profile.relationship;
  const meta = [
    profile.language,
    formatPhone(parent.phone_number),
    child ? `${child}${relation ? ` (${relation.toLowerCase()})` : ""}` : "",
  ].filter(Boolean);

  const conditions = profile.conditions || [];
  const medications = profile.medicines || [];
  const routines = profile.other_routines || [];
  const fromChild = (key: string) => parent.facts?.[key]?.source === "child" && !parent.facts?.[key]?.confirmed;
  const healthFromChild = parent.medical_baseline?.conditions?.source === "child" || parent.medical_baseline?.medicines?.source === "child";
  const living = LIVING_SITUATIONS.find((l) => l.id === profile.living_situation)?.label;

  const markDone = () => {
    if (status.cardId) markDoneMutation.mutate(status.cardId);
  };

  const openByAttempt = (attemptId: string) => {
    const match = calls.find((c: any) => c.attempt_id === attemptId || c.id === attemptId);
    setDrawerCall(
      match || {
        id: attemptId,
        attempt_id: attemptId,
        parent_name: parent.parent_name,
        parent_phone: parent.phone_number,
        child_name: child || "Family",
        call_status: "connected",
        duration_seconds: 0,
        created_at: "",
        has_recording: false,
      }
    );
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-[860px] px-5 sm:px-10 pt-6 sm:pt-8 pb-16">
        {backHref && (
          <Link href={backHref} className="lg:hidden inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-white mb-4 -ml-1">
            <ChevronLeft className="w-4 h-4" />
            Parents
          </Link>
        )}

        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold text-white tracking-tight truncate">{parent.parent_name}</h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              {meta.map((m, i) => (
                <span key={i} className="whitespace-nowrap">
                  {i > 0 && <span className="text-zinc-700 mx-2">·</span>}
                  {m}
                </span>
              ))}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" onClick={() => onEditClick(parent)}>
              Edit
            </Button>
            <Button
              variant="primary"
              onClick={() => onCallNow(parent)}
              disabled={isCalling}
              icon={<Phone className="w-3.5 h-3.5 fill-black" />}
            >
              {isCalling ? "Calling…" : `Call ${firstName}`}
            </Button>
          </div>
        </header>

        <TabBar
          className="mt-7"
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "summary", label: "Summary" },
            { id: "report", label: "Report" },
            { id: "overview", label: "Overview" },
            { id: "calls", label: "Calls", count: calls.length || undefined },
            { id: "memory", label: "Memory" },
            { id: "profile", label: "Profile" },
          ]}
        />

        {activeTab === "summary" && <SummaryTab parentId={parent.id} parentName={parent.parent_name} />}
        {activeTab === "report" && <ReportTab parentId={parent.id} parentName={parent.parent_name} />}

        {activeTab === "overview" && (
          <div className="pt-8">
            {/* Right now */}
            <section>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">
                    <StatusLabel tone={status.tone}>{status.label}</StatusLabel>
                  </div>
                  {status.reason && status.reason !== status.label && status.reason !== watchlist[0] && (
                    <p className="mt-1.5 text-[14px] text-zinc-300 leading-6">{status.reason}</p>
                  )}
                </div>
                {status.cardId && status.needsAttention && (
                  <Button size="sm" variant="ghost" onClick={markDone} disabled={markDoneMutation.isPending}>
                    Mark done
                  </Button>
                )}
              </div>
              {(watchlist.length > 0 || (nextStep && nextStep !== status.reason)) && (
                <dl className="mt-4">
                  {watchlist.length > 0 && (
                    <Field label="Anya will ask">
                      {watchlist.slice(0, 3).map((w, i) => (
                        <div key={i}>{w}</div>
                      ))}
                    </Field>
                  )}
                  {nextStep && nextStep !== status.reason && <Field label="Next step">{nextStep}</Field>}
                </dl>
              )}
            </section>

            {/* Latest call */}
            <Section
              title="Latest check-in"
              aside={
                lastConnected ? (
                  <button onClick={() => setDrawerCall(lastConnected)} className="text-[12.5px] text-zinc-400 hover:text-white">
                    Open call →
                  </button>
                ) : null
              }
              className="pt-10"
            >
              {lastConnected ? (
                <div>
                  <p className="text-[12.5px] text-zinc-500">
                    {formatDateTime(lastConnected.created_at)}
                    <span className="text-zinc-700 mx-2">·</span>
                    {formatDuration(lastConnected.duration_seconds)}
                    {lastConnected.parent_mood && (
                      <>
                        <span className="text-zinc-700 mx-2">·</span>
                        {humanize(lastConnected.parent_mood)}
                      </>
                    )}
                  </p>
                  <p className="mt-2 text-[15px] text-zinc-100 leading-7">
                    {lastConnected.health_update || lastConnected.call_summary || "Check-in completed."}
                  </p>
                  {lastConnected.has_recording && lastConnected.interaction_id && (
                    <div className="mt-4 max-w-[520px]">
                      <AudioPlayer
                        key={lastConnected.interaction_id}
                        interactionId={lastConnected.interaction_id}
                        fallbackDuration={lastConnected.duration_seconds}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[14px] text-zinc-400">
                  {calls.length > 0 ? "No call has connected yet." : `No calls yet. Call ${firstName} to start daily check-ins.`}
                </p>
              )}
            </Section>

            {/* Trends */}
            <Section title="Last 7 days" className="pt-10">
              <TrendStrip logs={parent.dailyLogs || []} calls={calls} />
            </Section>
          </div>
        )}

        {activeTab === "calls" && (
          <div className="pt-4">
            {calls.length === 0 ? (
              <EmptyState title={`No calls with ${firstName} yet.`}>
                Each call shows up here with its recording, transcript and Anya&apos;s review.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-ay-line">
                {calls.map((call: any, idx: number) => (
                  <CallRow
                    key={call.id || idx}
                    call={call}
                    onOpen={() => setDrawerCall(call)}
                    onIntent={() => prefetchCall(queryClient, call)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "memory" && (
          <div className="pt-8">
            <div className="flex justify-end mb-2">
              <Link href={`/memory/${parent.id}`} className="text-[12.5px] text-zinc-500 hover:text-white">
                Open full page
              </Link>
            </div>
            <ProgressiveMemory key={`pm-${parent.id}`} parentId={parent.id} />
            <h3 className="mt-14 mb-4 text-[13px] font-medium text-zinc-500">Old memory (sent to the agent while in shadow mode)</h3>
            <MemoryPanel
              key={parent.id}
              parentId={parent.id}
              parentName={parent.parent_name}
              onOpenCall={openByAttempt}
            />
          </div>
        )}

        {activeTab === "profile" && (
          <div className="pt-6">
            <Section title="Contact" className="pt-0" aside={
              <button onClick={() => onEditClick(parent)} className="text-[12.5px] text-zinc-400 hover:text-white">Edit</button>
            }>
              <dl>
                <Field label="Phone">{formatPhone(parent.phone_number)}</Field>
                <Field label="Anyash calls them">{parent.honorific || "—"}</Field>
                <Field label="Language">{profile.language}</Field>
                <Field label="Family">{child ? `${child}, their ${(relation || "child").toLowerCase()}` : "—"}</Field>
              </dl>
            </Section>
            <CallTimingSection parent={parent} onEdit={() => onEditClick(parent)} />
            <Section title="Home and life" aside={<FromChildTag show={["living_situation", "enjoys"].some(fromChild)} />}>
              <dl>
                <Field label="Lives">{living || <span className="text-zinc-500">Not given</span>}</Field>
                <Field label="Help at home">{profile.household_help || <span className="text-zinc-500">Not given</span>}</Field>
                <Field label="Wakes">{clockLabel(profile.wake_time) || <span className="text-zinc-500">Not given</span>}</Field>
                <Field label="Enjoys">{profile.enjoys || <span className="text-zinc-500">Not given</span>}</Field>
                <Field label="Avoid">{profile.avoid_topics || <span className="text-zinc-500">Nothing noted</span>}</Field>
              </dl>
            </Section>
            {profile.child_worry && (
              <Section title={`${child || "The family"}'s worry`}>
                <p className="text-[14px] text-zinc-100 leading-6">{profile.child_worry}</p>
                <p className="mt-1 text-[12px] text-zinc-600">Only shown here. Never sent to Anyash or said to the parent.</p>
              </Section>
            )}
            <Section title="Health" aside={<FromChildTag show={healthFromChild} />}>
              <dl>
                <Field label="Conditions">
                  {conditions.length ? conditions.map((c, i) => <div key={i}>{c}</div>) : <span className="text-zinc-500">None recorded</span>}
                </Field>
                <Field label="Medicines">
                  {medications.length ? medications.map((m, i) => <div key={i}>{m}</div>) : <span className="text-zinc-500">None recorded</span>}
                </Field>
              </dl>
            </Section>
            <Section title="Daily routine">
              {routines.length ? (
                <dl>
                  {routines.map((r, i) => (
                    <Field key={i} label={r.time && r.time !== "Daily Routine" ? r.time : "—"}>
                      {r.activity}
                    </Field>
                  ))}
                </dl>
              ) : (
                <p className="text-[13px] text-zinc-500">No routine recorded.</p>
              )}
            </Section>
            {parent.created_at && (
              <p className="pt-10 text-[12px] text-zinc-600">
                Added {formatRelative(parent.created_at)}
                {parent.number_of_calls ? ` · next call is #${parent.number_of_calls}` : ""}
              </p>
            )}
          </div>
        )}
      </div>

      <CallDetailDrawer call={drawerCall} onClose={() => setDrawerCall(null)} />
    </div>
  );
}
