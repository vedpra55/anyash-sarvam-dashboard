"use client";

import React, { useState, useRef } from "react";
import {
  PhoneCall,
  Calendar,
  Play,
  Pause,
  Heart,
  Smile,
  Pill,
  Sun,
  FileText,
  Clock,
  Trash2,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { ParentItem } from "./ParentsListColumn";
import { CallDetailDrawer } from "./CallDetailDrawer";
import { MemoryPanel } from "./MemoryPanel";
import { StatusLabel, callStatusMeta, humanize, formatDuration } from "./detail-ui";
import { SarvamCallRecord } from "@/lib/sarvam";

export type DetailSubTab = "overview" | "calls" | "health" | "memory" | "details";

interface ParentDetailCanvasProps {
  parent: ParentItem | null;
  onCallNow: (parent: ParentItem) => void;
  onEditClick: (parent: ParentItem) => void;
  onDeleteClick?: (parent: ParentItem) => void;
  isCalling?: boolean;
}

function formatOutcomeTag(outcome?: string) {
  if (!outcome) return "Routine";
  return outcome
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ParentDetailCanvas({
  parent,
  onCallNow,
  onEditClick,
  onDeleteClick,
  isCalling = false,
}: ParentDetailCanvasProps) {
  const [activeTab, setActiveTab] = useState<DetailSubTab>("overview");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedCallForDrawer, setSelectedCallForDrawer] = useState<SarvamCallRecord | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  if (!parent) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-[#0C0D0E] text-center p-8 select-none">
        <div className="w-14 h-14 rounded-2xl bg-[#141619] border border-[#202328] flex items-center justify-center mb-4">
          <Heart className="w-6 h-6 text-[#717680]" />
        </div>
        <h3 className="text-base font-semibold text-white">No parent selected</h3>
        <p className="text-xs text-[#717680] max-w-sm mt-1">
          Add a parent profile to start daily wellness check-ins, record vitals, and track longitudinal health.
        </p>
      </div>
    );
  }

  // Derive display values from real parent data
  const relationship = parent.facts?.relationship || "Parent";
  const phone = parent.phone_number || "";
  const child = parent.child_name || parent.facts?.family_member || "Family";

  // Last call data (from live Sarvam calls)
  const lastCall = parent.latestCall;
  const hasCalls = Boolean(lastCall);
  const lastCallDate = lastCall?.created_at
    ? new Date(lastCall.created_at).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      }) +
      ", " +
      new Date(lastCall.created_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const lastCallDuration = lastCall?.duration_seconds
    ? `${Math.round(lastCall.duration_seconds)}s`
    : "";

  const lastCallSummary =
    lastCall?.call_summary ||
    parent.latestLog?.raw_summary ||
    "";

  // Health signals
  const healthStatus = hasCalls
    ? lastCall?.call_status === "connected" || lastCall?.call_status === "completed"
      ? "Stable"
      : "Recorded"
    : "Pending";

  const moodValue = lastCall?.parent_mood
    ? lastCall.parent_mood.replace(/_/g, " ")
    : hasCalls ? "Normal" : "Awaiting call";

  const moodNote =
    lastCall?.mood_note ||
    lastCall?.agent_variables?.mood_note ||
    lastCall?.agent_variables?.conversation_signal?.replace(/_/g, " ") ||
    (hasCalls ? "Check-in logged" : "No notes yet");

  const medsValue = parent.latestLog?.medication_adherence?.adherence || (hasCalls ? "Checked" : "Awaiting call");
  const medsNote = parent.latestLog?.medication_adherence?.refill_warnings || (hasCalls ? "Tracked in call" : "No notes yet");

  // Routine
  const routineItems = parent.routines || [];
  const routineText = routineItems
    .map((r: any) => `${r.time ? r.time + " " : ""}${r.activity}`)
    .join("; ");

  // Known conditions
  const conditions =
    parent.medical_baseline?.conditions && Array.isArray(parent.medical_baseline.conditions)
      ? parent.medical_baseline.conditions
      : [];

  // Handle Play audio toggle
  const togglePlayAudio = () => {
    if (!lastCall) return;

    if (audioPlayerRef.current) {
      if (isPlayingAudio) {
        audioPlayerRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioPlayerRef.current.play().catch(() => setIsPlayingAudio(false));
        setIsPlayingAudio(true);
      }
      return;
    }

    const audioUrl = lastCall.interaction_id
      ? `/api/calls/recording?interaction_id=${encodeURIComponent(lastCall.interaction_id)}`
      : lastCall.audio_url;

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      audio.play().catch(() => setIsPlayingAudio(false));
      setIsPlayingAudio(true);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#0C0D0E] flex flex-col p-8 select-none">
      {/* 1. Profile Header Banner */}
      <div className="flex items-center justify-between pb-6 border-b border-[#1C1F24]/80">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {parent.parent_name}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Check-in
              </span>
            </div>
            <div className="text-sm text-[#8E929A] mt-1 flex items-center gap-2 flex-wrap">
              <span>{relationship}</span>
              {phone && (
                <>
                  <span className="text-[#4E5460]">•</span>
                  <span className="font-mono text-xs text-[#A0A6B2]">{phone}</span>
                </>
              )}
              {child && (
                <>
                  <span className="text-[#4E5460]">•</span>
                  <span>Child: {child}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons: Edit, Remove, Call Now */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onEditClick(parent)}
            className="px-4 py-2 rounded-full text-xs font-semibold text-[#C3C7D0] bg-[#181A1D] hover:bg-[#202328] hover:text-white border border-[#2A2E35] transition-colors"
          >
            Edit
          </button>

          {onDeleteClick && (
            <button
              onClick={() => onDeleteClick(parent)}
              className="p-2 rounded-full text-[#8E929A] hover:text-rose-400 bg-[#181A1D] hover:bg-rose-950/40 border border-[#2A2E35] hover:border-rose-800/40 transition-colors"
              title="Remove parent"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onCallNow(parent)}
            disabled={isCalling}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-all border shadow-sm ${
              isCalling
                ? "bg-[#252830] text-[#9CA3AF] border-[#374151] cursor-not-allowed animate-pulse"
                : "bg-[#FEE5A5] text-black border-[#FEE5A5] hover:bg-[#fde08f] active:scale-95"
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 fill-black" />
            <span>{isCalling ? "Calling..." : `Call ${parent.parent_name.split(" ")[0]}`}</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex items-center gap-8 pt-5 border-b border-white/[0.06]">
        {(["overview", "calls", "health", "memory", "details"] as DetailSubTab[]).map(
          (tab) => {
            const isActive = activeTab === tab;
            const label = tab === "calls" && parent.calls && parent.calls.length > 0
              ? `Calls (${parent.calls.length})`
              : tab.charAt(0).toUpperCase() + tab.slice(1);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative pb-3 text-sm font-medium transition-colors ${
                  isActive ? "text-white" : "text-[#717680] hover:text-[#D1D5DB]"
                }`}
              >
                <span>{label}</span>
                {isActive && (
                  <span className="absolute -bottom-px left-0 right-0 h-px bg-white" />
                )}
              </button>
            );
          }
        )}
      </div>

      {/* 3. Tab Contents */}
      {activeTab === "overview" && (
        <div className="pt-6 space-y-4 max-w-4xl">
          {/* Card 1: Last Call Card */}
          <div className="bg-[#141619] rounded-2xl border border-[#202328] p-5 shadow-sm space-y-3">
            {hasCalls ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#8E929A] text-xs font-medium flex-wrap">
                    <Calendar className="w-4 h-4 text-[#717680]" />
                    <span className="text-white font-semibold">Last call</span>
                    <span>•</span>
                    <span>{lastCallDate}</span>
                    {lastCallDuration && (
                      <>
                        <span>•</span>
                        <span className="font-mono">{lastCallDuration}</span>
                      </>
                    )}
                    {lastCall?.call_outcome && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-medium">
                        {formatOutcomeTag(lastCall.call_outcome)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {lastCall?.has_recording && (
                      <button
                        onClick={togglePlayAudio}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1F24] hover:bg-[#252830] text-xs font-medium text-white transition-colors border border-[#2B2F38]"
                      >
                        {isPlayingAudio ? (
                          <Pause className="w-3.5 h-3.5 text-[#FEE5A5]" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-[#FEE5A5]" />
                        )}
                        <span>{isPlayingAudio ? "Playing..." : "Play audio"}</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedCallForDrawer(lastCall)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 hover:text-white transition-colors border border-white/[0.06]"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#FEE5A5]" />
                      <span>Inspect Call</span>
                    </button>
                  </div>
                </div>

                <p className="text-sm text-[#D1D5DB] leading-relaxed">
                  {lastCallSummary || "Routine check-in call completed."}
                </p>

                {lastCall?.health_update && lastCall.health_update !== lastCallSummary && (
                  <div className="pt-2 border-t border-white/[0.04]">
                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block mb-0.5">
                      Health Observation
                    </span>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {lastCall.health_update}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="py-2 text-left space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Calendar className="w-4 h-4 text-[#717680]" />
                  <span>No check-in calls logged yet</span>
                </div>
                <p className="text-xs text-[#8E929A]">
                  Click &ldquo;Call {parent.parent_name.split(" ")[0]}&rdquo; above to initiate the first AI wellness conversation.
                </p>
              </div>
            )}
          </div>

          {/* Row 2: Three Health Signal Cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* General Health */}
            <div className="bg-[#141619] rounded-2xl border border-[#202328] p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[#8E929A]">
                <Heart className="w-3.5 h-3.5 text-[#8E929A]" />
                <span>General health</span>
              </div>
              <div>
                <div className="text-base font-bold text-white tracking-tight">
                  {healthStatus}
                </div>
                <div className="text-xs text-[#717680] mt-0.5">
                  {hasCalls ? "Monitored via check-in" : "Awaiting first call"}
                </div>
              </div>
            </div>

            {/* Mood */}
            <div className="bg-[#141619] rounded-2xl border border-[#202328] p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[#8E929A]">
                <Smile className="w-3.5 h-3.5 text-[#8E929A]" />
                <span>Mood</span>
              </div>
              <div>
                <div className="text-base font-bold text-white tracking-tight capitalize">
                  {moodValue}
                </div>
                <div className="text-xs text-[#717680] mt-0.5 truncate">{moodNote}</div>
              </div>
            </div>

            {/* Medicines */}
            <div className="bg-[#141619] rounded-2xl border border-[#202328] p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[#8E929A]">
                <Pill className="w-3.5 h-3.5 text-[#8E929A]" />
                <span>Medicines</span>
              </div>
              <div>
                <div className="text-base font-bold text-white tracking-tight capitalize">
                  {medsValue}
                </div>
                <div className="text-xs text-[#717680] mt-0.5">{medsNote}</div>
              </div>
            </div>
          </div>

          {/* Row 3: Two Context Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Usual Routine */}
            <div className="bg-[#141619] rounded-2xl border border-[#202328] p-5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-[#8E929A]">
                <Sun className="w-4 h-4 text-[#8E929A]" />
                <span className="text-white font-semibold">Usual routine</span>
              </div>
              <p className="text-xs text-[#B5BAC3] leading-relaxed">
                {routineText || "No routines specified yet. You can add them in Edit details."}
              </p>
            </div>

            {/* Known Conditions */}
            <div className="bg-[#141619] rounded-2xl border border-[#202328] p-5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-[#8E929A]">
                <FileText className="w-4 h-4 text-[#8E929A]" />
                <span className="text-white font-semibold">Known conditions</span>
              </div>
              <div className="space-y-1">
                {conditions.length > 0 ? (
                  conditions.map((c: string, idx: number) => (
                    <div key={idx} className="text-xs text-[#B5BAC3] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#525866]" />
                      <span>{c}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#717680]">No chronic health conditions recorded.</p>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Footer Info Line */}
          <div className="pt-2 flex items-center gap-2 text-xs text-[#717680]">
            <Clock className="w-3.5 h-3.5 text-[#8E929A]" />
            <span>
              {hasCalls
                ? "Next check-in scheduled • Tomorrow"
                : "Daily check-in schedule activates after the initial call."}
            </span>
          </div>
        </div>
      )}

      {/* Calls Tab */}
      {activeTab === "calls" && (
        <div className="pt-6 max-w-4xl">
          {(!parent.calls || parent.calls.length === 0) ? (
            <div className="py-10">
              <p className="text-[14px] text-zinc-300">No calls with {parent.parent_name} yet.</p>
              <p className="text-[13px] text-zinc-500 mt-1">
                Calls to {parent.phone_number} show up here with their recording, transcript and Anya&apos;s review.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {parent.calls.map((call: any, idx: number) => {
                const status = callStatusMeta(call.call_status);
                const needsFollowUp = call.follow_up_needed === "yes";
                const when = new Date(call.created_at);
                return (
                  <li key={call.id || idx}>
                    <button
                      onClick={() => setSelectedCallForDrawer(call)}
                      className="w-full grid grid-cols-[132px_1fr_16px] gap-x-6 py-4 text-left group"
                    >
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
                        <div className="flex items-center gap-3 text-[12px]">
                          <StatusLabel tone={status.tone}>{status.label}</StatusLabel>
                          {call.call_outcome && <span className="text-zinc-500">{humanize(call.call_outcome)}</span>}
                          {needsFollowUp && <StatusLabel tone="watch">Follow-up</StatusLabel>}
                        </div>
                        <p className="text-[13px] text-zinc-400 group-hover:text-zinc-200 leading-6 mt-1 line-clamp-2 transition-colors">
                          {call.call_summary || call.health_update || (status.tone === "good" ? "Check-in completed." : "No conversation.")}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-300 transition-colors self-center" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Health Tab */}
      {activeTab === "health" && (
        <div className="pt-6 space-y-3 max-w-4xl">
          <h3 className="text-sm font-semibold text-white mb-2">Daily Health Logs</h3>
          {(!parent.dailyLogs || parent.dailyLogs.length === 0) ? (
            <div className="p-8 bg-[#141619] rounded-2xl border border-[#202328] text-center text-xs text-[#717680]">
              No health logs recorded yet.
            </div>
          ) : (
            parent.dailyLogs.map((log: any, idx: number) => (
              <div
                key={log.id || idx}
                className="bg-[#141619] rounded-2xl border border-[#202328] p-4 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{log.log_date}</span>
                  <span className="text-[#8E929A]">
                    Sleep: {log.sleep_hours ? `${log.sleep_hours}h` : "Normal"} • {log.sleep_quality || "good"}
                  </span>
                </div>
                <p className="text-xs text-[#B5BAC3]">
                  {log.raw_summary || "Daily wellness check-in completed."}
                </p>
                {log.mobility_and_pain?.nature && (
                  <div className="text-[11px] text-[#8E929A] bg-[#181A1E] p-2 rounded-lg border border-[#22252C]">
                    Mobility: {log.mobility_and_pain.nature}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Memory Tab */}
      {activeTab === "memory" && (
        <div className="pt-8">
          <MemoryPanel
            key={parent.id}
            parentId={parent.id}
            parentName={parent.parent_name}
            onOpenCall={(attemptId) => {
              const match = (parent.calls || []).find(
                (c: any) => c.attempt_id === attemptId || c.id === attemptId
              );
              setSelectedCallForDrawer(
                match || {
                  id: attemptId,
                  attempt_id: attemptId,
                  parent_name: parent.parent_name,
                  parent_phone: parent.phone_number,
                  child_name: child,
                  call_status: "connected",
                  duration_seconds: 0,
                  created_at: "",
                  has_recording: false,
                }
              );
            }}
          />
        </div>
      )}

      {/* Details Tab */}
      {activeTab === "details" && (
        <div className="pt-6 space-y-4 max-w-4xl">
          <div className="bg-[#141619] rounded-2xl border border-[#202328] p-6 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-white mb-3">Family & Caregiver Context</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[#717680] block">Parent Name</span>
                <span className="text-white font-medium text-sm mt-0.5 block">{parent.parent_name}</span>
              </div>
              <div>
                <span className="text-[#717680] block">Phone Number</span>
                <span className="text-white font-medium text-sm mt-0.5 block">{parent.phone_number}</span>
              </div>
              <div>
                <span className="text-[#717680] block">Caregiver / Child</span>
                <span className="text-white font-medium text-sm mt-0.5 block">{child} ({relationship})</span>
              </div>
              <div>
                <span className="text-[#717680] block">Honorific</span>
                <span className="text-white font-medium text-sm mt-0.5 block">{parent.honorific || "Mummy Ji"}</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Slide-over Drawer for full call inspection */}
      <CallDetailDrawer
        call={selectedCallForDrawer}
        onClose={() => setSelectedCallForDrawer(null)}
      />
    </div>
  );
}
