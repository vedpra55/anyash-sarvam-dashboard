"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  Pause,
  Volume2,
  Sparkles,
  MessageSquare,
  RotateCw,
  Bot,
  User,
  AlertCircle,
  CheckCircle2,
  Smile,
  HeartPulse,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SarvamCallRecord } from "@/lib/sarvam";

interface CallDetailDrawerProps {
  call: SarvamCallRecord | null;
  onClose: () => void;
}

interface TranscriptTurn {
  turn_id: string;
  role: "agent" | "user";
  text: string;
  audio_start_ms?: number;
  audio_end_ms?: number;
}

function formatDuration(sec?: number): string {
  if (!sec || sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function formatAudioTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function formatCallDate(isoStr?: string): string {
  if (!isoStr) return "Unknown Date";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "Unknown Date";

  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatOutcomeLabel(outcome?: string): string {
  if (!outcome) return "Routine Call";
  return outcome
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function CallDetailDrawer({ call, onClose }: CallDetailDrawerProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [showRawVariables, setShowRawVariables] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Reset audio & fetch transcript when call changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setTranscript([]);

    if (!call?.interaction_id && !call?.attempt_id && !call?.id) return;

    let isMounted = true;
    setIsLoadingTranscript(true);

    const params = new URLSearchParams();
    if (call.interaction_id && call.interaction_id !== "NO_INTERACTION_ID") {
      params.set("interaction_id", call.interaction_id);
    }
    const attemptId = call.attempt_id || call.id;
    if (attemptId) {
      params.set("attempt_id", attemptId);
    }

    fetch(`/api/calls/transcript?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const rawTurns = Array.isArray(data.transcript) && data.transcript.length > 0
          ? data.transcript
          : Array.isArray(data.messages) && data.messages.length > 0
          ? data.messages
          : [];

        const turns: TranscriptTurn[] = rawTurns.map((turn: any, idx: number) => ({
          turn_id: String(turn.turn_id || idx + 1),
          role: turn.role === "assistant" || turn.role === "agent" ? "agent" : "user",
          text: turn.text || turn.content || "",
          audio_start_ms: turn.audio_start_ms,
          audio_end_ms: turn.audio_end_ms,
        }));

        setTranscript(turns);
      })
      .catch((err) => {
        console.error("Failed to load transcript:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingTranscript(false);
      });

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [call?.interaction_id, call?.attempt_id, call?.id]);

  if (!call) return null;

  const isConnected = call.call_status === "connected" || call.call_status === "completed";
  const isBusy = call.call_status === "busy";
  const parentName = call.parent_name || "Parent";
  const childName = call.child_name || call.agent_variables?.child_name || "Family";

  // Audio Handlers
  const toggleAudio = () => {
    if (!call.interaction_id) return;

    if (!audioRef.current) {
      const audioUrl = `/api/calls/recording?interaction_id=${encodeURIComponent(call.interaction_id)}`;
      const audio = new Audio(audioUrl);

      audio.ontimeupdate = () => {
        if (!audio.duration) return;
        const progress = (audio.currentTime / audio.duration) * 100;
        setAudioProgress(progress);
        setAudioCurrentTime(audio.currentTime);
      };

      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
      };

      audio.onended = () => {
        setIsPlayingAudio(false);
        setAudioProgress(0);
        setAudioCurrentTime(0);
      };

      audio.onerror = () => {
        setIsPlayingAudio(false);
      };

      audioRef.current = audio;
    }

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play().catch(() => setIsPlayingAudio(false));
      setIsPlayingAudio(true);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = newProgress * (audioRef.current.duration || call.duration_seconds || 1);
    audioRef.current.currentTime = newTime;
    setAudioProgress(newProgress * 100);
    setAudioCurrentTime(newTime);
  };

  const hasFollowUp =
    call.follow_up_needed === "yes" ||
    (call.follow_up_detail &&
      call.follow_up_detail.toLowerCase() !== "no action needed" &&
      call.follow_up_detail.trim().length > 0);

  const rawVars = call.agent_variables || {};

  return (
    <>
      {/* Subtle Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <aside className="fixed top-0 right-0 h-full w-full max-w-[540px] z-50 bg-[#0E0F12] border-l border-[#22242B] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 select-none">
        {/* Header */}
        <div className="p-5 border-b border-[#1C1F24] flex items-center justify-between shrink-0 bg-[#121316]">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-white tracking-tight truncate">
                {parentName}
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${
                  isConnected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : isBusy
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                <span className="capitalize">{call.call_status || "connected"}</span>
              </span>
            </div>

            <div className="text-xs text-zinc-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{call.parent_phone}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400 font-sans">{formatCallDate(call.created_at)}</span>
              {call.duration_seconds > 0 && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span>{formatDuration(call.duration_seconds)}</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white flex items-center justify-center transition-colors shrink-0 ml-3"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* 1. Studio Audio Player */}
          {call.has_recording && (
            <div className="bg-[#141519] border border-[#22242B] rounded-2xl p-3.5 flex items-center gap-3.5 shadow-sm">
              <button
                onClick={toggleAudio}
                className="w-9 h-9 rounded-full bg-[#FEE5A5] hover:bg-[#ffe082] text-black flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-md"
                title={isPlayingAudio ? "Pause recording" : "Play recording"}
              >
                {isPlayingAudio ? (
                  <Pause className="w-4 h-4 fill-black" />
                ) : (
                  <Play className="w-4 h-4 fill-black ml-0.5" />
                )}
              </button>

              <div className="flex-1 flex flex-col justify-center space-y-1.5 min-w-0">
                <div
                  ref={progressBarRef}
                  onClick={handleSeek}
                  className="relative h-1.5 w-full bg-zinc-800 rounded-full cursor-pointer overflow-hidden group"
                >
                  <div
                    className="h-full bg-[#FEE5A5] rounded-full transition-all duration-100"
                    style={{ width: `${audioProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span>{formatAudioTime(audioCurrentTime)}</span>
                  <span className="flex items-center gap-1 text-zinc-500">
                    <Volume2 className="w-3 h-3 text-zinc-500" />
                    {audioDuration > 0
                      ? formatAudioTime(audioDuration)
                      : formatDuration(call.duration_seconds)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Primary Outcome & Summary Card */}
          <div className="bg-[#131418] border border-[#22242B] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-300 font-semibold text-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#FEE5A5]" />
                Session Takeaways
              </span>
              {call.call_outcome && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-medium">
                  {formatOutcomeLabel(call.call_outcome)}
                </span>
              )}
            </div>

            {call.call_summary ? (
              <p className="text-zinc-200 leading-relaxed text-xs">
                {call.call_summary}
              </p>
            ) : (
              <p className="text-zinc-500 text-xs italic">
                Introductory check-in call completed.
              </p>
            )}

            {call.health_update && call.health_update !== call.call_summary && (
              <div className="pt-2.5 border-t border-white/[0.04]">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  <HeartPulse className="w-3 h-3 text-rose-400" />
                  Health Observation
                </div>
                <p className="text-zinc-300 leading-relaxed text-xs">
                  {call.health_update}
                </p>
              </div>
            )}
          </div>

          {/* 3. Mood & Engagement Card */}
          {(call.parent_mood || call.mood_note || call.conversation_signal) && (
            <div className="bg-[#131418] border border-[#22242B] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-zinc-300 font-semibold text-xs">
                  <Smile className="w-3.5 h-3.5 text-emerald-400" />
                  Mood & Engagement
                </span>
                {call.conversation_signal && (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-mono">
                    {call.conversation_signal.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              {call.mood_note ? (
                <p className="text-zinc-300 leading-relaxed text-xs">
                  {call.mood_note}
                </p>
              ) : call.parent_mood ? (
                <p className="text-zinc-300 text-xs capitalize">
                  Status: {call.parent_mood.replace(/_/g, " ")}
                </p>
              ) : null}
            </div>
          )}

          {/* 4. Follow-up Action Required Alert */}
          {hasFollowUp ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Follow-up Action Needed
              </div>
              <p className="text-zinc-200 text-xs leading-relaxed">
                {call.follow_up_detail}
              </p>
            </div>
          ) : (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3.5 flex items-center gap-2.5 text-xs text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>No critical medical follow-up or escalations flagged for this call.</span>
            </div>
          )}

          {/* 5. Longitudinal & Personal Context */}
          {(call.ongoing_health_context || call.personal_context) && (
            <div className="bg-[#131418] border border-[#22242B] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-zinc-300 font-semibold text-xs">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                Longitudinal Context
              </div>

              {call.ongoing_health_context && (
                <div>
                  <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block mb-0.5">
                    Ongoing Health Context
                  </span>
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    {call.ongoing_health_context}
                  </p>
                </div>
              )}

              {call.personal_context && (
                <div className="pt-2 border-t border-white/[0.04]">
                  <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider block mb-0.5">
                    Personal & Family Context
                  </span>
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    {call.personal_context}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 6. Raw Variables Inspector (Collapsible) */}
          {Object.keys(rawVars).length > 0 && (
            <div className="border border-[#22242B] rounded-2xl overflow-hidden bg-[#111215]">
              <button
                onClick={() => setShowRawVariables(!showRawVariables)}
                className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                <span>Sarvam AI Output Variables ({Object.keys(rawVars).length})</span>
                {showRawVariables ? (
                  <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
              </button>

              {showRawVariables && (
                <div className="p-3.5 pt-0 border-t border-[#1C1F24] space-y-2">
                  <div className="grid grid-cols-1 gap-2 pt-2">
                    {Object.entries(rawVars).map(([key, value]) => (
                      <div
                        key={key}
                        className="bg-[#16181D] border border-[#262A32] rounded-xl p-2.5 space-y-0.5"
                      >
                        <span className="font-mono text-[10px] text-amber-300/80 block">
                          {key}
                        </span>
                        <span className="font-mono text-xs text-zinc-200 break-words block">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. Turn-by-Turn Conversational Dialogue Feed */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-300 flex items-center gap-1.5 text-xs">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                Conversation Dialogue
              </span>
              {transcript.length > 0 && (
                <span className="text-[11px] font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
                  {transcript.length} turns
                </span>
              )}
            </div>

            {isLoadingTranscript ? (
              <div className="bg-[#131418] border border-[#22242B] rounded-2xl p-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                <RotateCw className="w-3.5 h-3.5 animate-spin text-[#FEE5A5]" />
                Loading conversation transcript...
              </div>
            ) : transcript.length > 0 ? (
              <div className="space-y-3.5 pt-1">
                {transcript.map((turn, idx) => {
                  const isAgent = turn.role === "agent";
                  return (
                    <div
                      key={turn.turn_id || idx}
                      className={`flex flex-col ${isAgent ? "items-start" : "items-end"}`}
                    >
                      {/* Speaker Tag */}
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        {isAgent ? (
                          <>
                            <Bot className="w-3 h-3 text-[#FEE5A5]" />
                            <span className="text-[10px] font-medium text-[#FEE5A5]">
                              Anya <span className="text-zinc-500 font-normal">AI Companion</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-medium text-zinc-400">
                              {parentName}
                            </span>
                            <User className="w-3 h-3 text-zinc-400" />
                          </>
                        )}
                      </div>

                      {/* Bubble */}
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          isAgent
                            ? "bg-[#181A20] text-zinc-100 border border-[#282C35] rounded-tl-sm shadow-sm"
                            : "bg-[#1F2937] text-white border border-[#374151] rounded-tr-sm shadow-sm"
                        }`}
                      >
                        {turn.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#131418] border border-[#22242B] rounded-2xl p-6 text-center text-xs text-zinc-500">
                {call.duration_seconds > 0
                  ? "No spoken dialogue turns recorded for this call."
                  : "No conversation took place on this attempt."}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
