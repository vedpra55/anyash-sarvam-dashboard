"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Sidebar } from "@/components/anyash/Sidebar";
import { CallDetailDrawer } from "@/components/anyash/CallDetailDrawer";
import {
  RotateCw,
  Search,
  Play,
  Pause,
  Filter,
  X,
  ChevronRight,
  Calendar,
  MessageSquare,
  Sparkles,
  Phone,
  Volume2,
  Bot,
  User,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

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
}

interface TranscriptTurn {
  turn_id: number;
  role: "agent" | "user";
  content: string;
  text?: string;
  language_name?: string;
}

function isCallToday(isoString?: string) {
  if (!isoString) return false;
  const d = new Date(isoString);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isCallYesterday(isoString?: string) {
  if (!isoString) return false;
  const d = new Date(isoString);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

function formatCallDate(isoString?: string) {
  if (!isoString) return { date: "—", time: "—", full: "—" };
  const d = new Date(isoString);
  const isToday = isCallToday(isoString);
  const isYesterday = isCallYesterday(isoString);

  const date = isToday
    ? "Today"
    : isYesterday
    ? "Yesterday"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return { date, time, full: `${date}, ${time}` };
}

function formatDuration(sec?: number) {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatAudioTime(sec: number) {
  if (isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  // Filter state (defaults to 'all' so users see all >= 25 Sep calls immediately)
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "all">("all");
  const [selectedCall, setSelectedCall] = useState<CallItem | null>(null);

  // Transcript lazy cache
  const [transcripts, setTranscripts] = useState<Record<string, TranscriptTurn[]>>({});
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);

  // Audio Player State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Fetch Calls from Sarvam API route
  const fetchCalls = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);
      else setIsLoading(true);

      const res = await fetch("/api/calls");
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || []);
      }
    } catch (err) {
      console.error("Failed to load calls from Sarvam API:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Load Transcript for selected call
  useEffect(() => {
    if (!selectedCall || !selectedCall.interaction_id) {
      return;
    }

    const interactionId = selectedCall.interaction_id;
    if (transcripts[interactionId]) {
      return; // Already loaded
    }

    setIsLoadingTranscript(true);
    fetch(`/api/calls/transcript?interaction_id=${encodeURIComponent(interactionId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setTranscripts((prev) => ({
          ...prev,
          [interactionId]: data.messages || [],
        }));
      })
      .catch((err) => {
        console.warn("Could not load transcript for interaction:", interactionId, err);
        setTranscripts((prev) => ({
          ...prev,
          [interactionId]: [],
        }));
      })
      .finally(() => {
        setIsLoadingTranscript(false);
      });
  }, [selectedCall, transcripts]);

  // Keyboard navigation: Escape key closes sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedCall(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Audio playback lifecycle management
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlayingAudio(false);
    setAudioProgress(0);
    setAudioCurrentTime(0);
    setAudioDuration(0);
  }, [selectedCall?.id]);

  const toggleAudio = (interactionId?: string) => {
    if (!interactionId) return;
    const audioUrl = `/api/calls/recording?interaction_id=${encodeURIComponent(interactionId)}`;

    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
      return;
    }

    if (!audioRef.current || audioRef.current.src !== window.location.origin + audioUrl) {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration && !isNaN(audio.duration)) {
          setAudioCurrentTime(audio.currentTime);
          setAudioDuration(audio.duration);
          setAudioProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration)) {
          setAudioDuration(audio.duration);
        }
      };

      audio.onended = () => {
        setIsPlayingAudio(false);
        setAudioProgress(0);
        setAudioCurrentTime(0);
      };
    }

    audioRef.current
      .play()
      .then(() => {
        setIsPlayingAudio(true);
      })
      .catch((e) => {
        console.warn("Audio playback issue:", e);
        setIsPlayingAudio(false);
      });
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressBarRef.current || !audioDuration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekPercentage = Math.max(0, Math.min(1, clickX / width));
    const newTime = seekPercentage * audioDuration;
    audioRef.current.currentTime = newTime;
    setAudioCurrentTime(newTime);
    setAudioProgress(seekPercentage * 100);
  };

  // Dynamic labels for Today & Yesterday
  const { todayLabel, yesterdayLabel } = useMemo(() => {
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tStr = now.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    const yStr = yesterday.toLocaleDateString("en-US", { day: "numeric", month: "short" });

    return { todayLabel: tStr, yesterdayLabel: yStr };
  }, []);

  // Date Chip Counts
  const todayCount = useMemo(
    () => calls.filter((c) => isCallToday(c.created_at)).length,
    [calls]
  );
  const yesterdayCount = useMemo(
    () => calls.filter((c) => isCallYesterday(c.created_at)).length,
    [calls]
  );
  const allCount = calls.length;

  // Filtered calls
  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      // 1. Text search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === "" ||
        (c.parent_name || "").toLowerCase().includes(q) ||
        (c.parent_phone || "").includes(q);

      // 2. Status filter
      const isConnected =
        c.call_status === "connected" || c.call_status === "completed";
      const isFailedOrBusy =
        c.call_status === "busy" ||
        c.call_status === "failed" ||
        c.call_status === "error";

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "connected" && isConnected) ||
        (statusFilter === "failed" && isFailedOrBusy);

      // 3. Date filter (defaults to Today - 25 Sep)
      const matchDate =
        dateFilter === "all" ||
        (dateFilter === "today" && isCallToday(c.created_at)) ||
        (dateFilter === "yesterday" && isCallYesterday(c.created_at));

      return matchSearch && matchStatus && matchDate;
    });
  }, [calls, searchQuery, statusFilter, dateFilter]);

  const currentTranscript = useMemo(() => {
    if (!selectedCall?.interaction_id) return [];
    return transcripts[selectedCall.interaction_id] || [];
  }, [selectedCall?.interaction_id, transcripts]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0B0D] text-[#D1D5DB] font-sans antialiased">
      {/* 1. Main Navigation Sidebar */}
      <Sidebar activeTab="calls" />

      {/* 2. Main Canvas */}
      <div className="flex-1 h-full overflow-y-auto flex flex-col p-8 space-y-6 select-none relative">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                Calls
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono font-medium text-zinc-400">
                {allCount} total
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Live Sarvam AI Voice Agent logs, recordings, and conversation dialogue.
            </p>
          </div>

          {/* Right Controls: Search, Status Filter, Refresh */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search parent or phone..."
                className="pl-8 pr-3.5 py-1.5 bg-[#121316] border border-white/[0.08] rounded-full text-xs text-white placeholder-zinc-500 outline-none focus:border-[#FEE5A5]/60 w-56 transition-colors"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121316] border border-white/[0.08] rounded-full text-xs text-zinc-300">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-white outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#121316]">All Status</option>
                <option value="connected" className="bg-[#121316]">Connected</option>
                <option value="failed" className="bg-[#121316]">Busy / Unanswered</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchCalls(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-white transition-all active:scale-95 disabled:opacity-50"
            >
              <RotateCw
                className={`w-3.5 h-3.5 text-[#FEE5A5] ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Date Filter Chips (Dynamic based on current local date) */}
        <div className="flex items-center gap-2">
          {/* 1. Today */}
          <button
            onClick={() => setDateFilter("today")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              dateFilter === "today"
                ? "bg-[#FEE5A5] text-black shadow-sm font-semibold"
                : "bg-[#131418] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]"
            }`}
          >
            <span>Today ({todayLabel})</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                dateFilter === "today"
                  ? "bg-black/15 text-black"
                  : "bg-white/[0.06] text-zinc-400"
              }`}
            >
              {todayCount}
            </span>
          </button>

          {/* 2. Yesterday */}
          <button
            onClick={() => setDateFilter("yesterday")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              dateFilter === "yesterday"
                ? "bg-[#FEE5A5] text-black shadow-sm font-semibold"
                : "bg-[#131418] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]"
            }`}
          >
            <span>Yesterday ({yesterdayLabel})</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                dateFilter === "yesterday"
                  ? "bg-black/15 text-black"
                  : "bg-white/[0.06] text-zinc-400"
              }`}
            >
              {yesterdayCount}
            </span>
          </button>

          {/* 3. All Calls */}
          <button
            onClick={() => setDateFilter("all")}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              dateFilter === "all"
                ? "bg-[#FEE5A5] text-black shadow-sm font-semibold"
                : "bg-[#131418] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]"
            }`}
          >
            <span>All Time</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                dateFilter === "all"
                  ? "bg-black/15 text-black"
                  : "bg-white/[0.06] text-zinc-400"
              }`}
            >
              {allCount}
            </span>
          </button>
        </div>

        {/* Clean Minimal Table: Only Most Important Things */}
        <div className="bg-[#111215] rounded-xl border border-white/[0.06] overflow-hidden shadow-sm flex-1 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center p-12 text-xs text-zinc-500">
              <RotateCw className="w-4 h-4 animate-spin text-[#FEE5A5] mr-2" />
              Loading calls from Sarvam AI...
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-xs text-zinc-500 text-center space-y-2">
              <p>
                No calls match{" "}
                <span className="text-zinc-300 font-medium">
                  {dateFilter === "today"
                    ? `Today (${todayLabel})`
                    : dateFilter === "yesterday"
                    ? `Yesterday (${yesterdayLabel})`
                    : "the selected filter"}
                </span>
                .
              </p>
              {dateFilter !== "all" && (
                <button
                  onClick={() => setDateFilter("all")}
                  className="text-xs text-[#FEE5A5] hover:underline pt-1"
                >
                  View All Time ({allCount} calls)
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[11px] font-medium text-zinc-400 uppercase tracking-wider bg-white/[0.01]">
                    <th className="py-3 px-6">Parent</th>
                    <th className="py-3 px-6">Date & Time</th>
                    <th className="py-3 px-6">Duration</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-xs">
                  {filteredCalls.map((call) => {
                    const isConnected =
                      call.call_status === "connected" ||
                      call.call_status === "completed";
                    const isBusy = call.call_status === "busy";
                    const durationText = formatDuration(call.duration_seconds);
                    const { date, time } = formatCallDate(call.created_at);
                    const isSelected = selectedCall?.id === call.id;

                    return (
                      <tr
                        key={call.id}
                        onClick={() => setSelectedCall(call)}
                        className={`transition-colors cursor-pointer group ${
                          isSelected
                            ? "bg-white/[0.06] text-white"
                            : "hover:bg-white/[0.03] text-zinc-300"
                        }`}
                      >
                        {/* 1. Parent Name & Phone Number */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <div>
                              <div className="font-medium text-white group-hover:text-[#FEE5A5] transition-colors">
                                {call.parent_name || "Parent"}
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                                {call.parent_phone || "—"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Small Date & Time */}
                        <td className="py-3 px-6 whitespace-nowrap">
                          <div className="text-zinc-200 font-medium">{date}</div>
                          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">{time}</div>
                        </td>

                        {/* 3. Duration */}
                        <td className="py-3 px-6 whitespace-nowrap font-mono text-zinc-400">
                          {durationText}
                        </td>

                        {/* 4. Clean Status Pill */}
                        <td className="py-3 px-6 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              isConnected
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : isBusy
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isConnected
                                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                                  : isBusy
                                  ? "bg-amber-400"
                                  : "bg-rose-400"
                              }`}
                            />
                            <span className="capitalize">
                              {call.call_status || "connected"}
                            </span>
                          </span>
                        </td>

                        {/* 5. Minimal Chevron Affordance */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors inline-block" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 3. Sleek, Executive Slide-Over Drawer with full Output Variables & Transcript */}
      <CallDetailDrawer
        call={selectedCall as any}
        onClose={() => setSelectedCall(null)}
      />
    </div>
  );
}
