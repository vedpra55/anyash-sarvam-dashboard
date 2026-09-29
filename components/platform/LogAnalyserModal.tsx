"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Copy,
  ExternalLink,
  Maximize2,
  Check,
  Play,
  Pause,
  Volume2,
  Download,
  Bot,
  Sliders,
  Sparkles,
  ShieldAlert,
  Clock,
  Send,
  Calendar,
  Phone,
} from "lucide-react";
import { CallRecord, CallTranscriptTurn } from "@/lib/types";

interface LogAnalyserModalProps {
  call: CallRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onCallParent?: (parentName?: string) => void;
}

export function LogAnalyserModal({
  call,
  isOpen,
  onClose,
  onCallParent,
}: LogAnalyserModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [activeRightTab, setActiveRightTab] = useState<"telemetry" | "decision">("decision");
  const [copiedId, setCopiedId] = useState(false);
  const [selectedTurnIdx, setSelectedTurnIdx] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen || !call) return null;

  const interactionId = call.interactionId || call.attemptId || "N/A";
  const parentName = call.parentName || call.userIdentifier || "Voice Session";
  const durationSec = Math.round(call.durationSeconds || 0);

  const handleCopyId = () => {
    navigator.clipboard.writeText(interactionId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const togglePlay = () => {
    if (call.audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSpeedCycle = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const next = speeds[nextIdx];
    setPlaybackSpeed(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Real transcript turns without mock fallbacks
  const transcript: CallTranscriptTurn[] = call.transcript || [];

  const selectedTurn =
    transcript[selectedTurnIdx] ||
    transcript[0] || {
      role: "agent",
      text: call.summary || "No transcript audio turned for this session.",
    };
  const decision = call.decisionCard;

  const decisionType = decision?.decision || "NORMAL";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] shadow-2xl border border-[#EAEAEA] flex flex-col overflow-hidden">
        {/* Hidden HTML audio element if audioUrl exists */}
        {call.audioUrl && (
          <audio
            ref={audioRef}
            src={call.audioUrl}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => setIsPlaying(false)}
          />
        )}

        {/* 1. Modal Top Bar (Image 5) */}
        <div className="px-6 py-3.5 border-b border-[#EAEAEA] flex items-center justify-between bg-white">
          <div className="flex flex-col">
            <h2 className="text-[17px] font-semibold tracking-tight text-[#111111]">
              Log Analyser
            </h2>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-[#666666] font-mono">
              <span>{interactionId}</span>
              <button
                onClick={handleCopyId}
                title="Copy Interaction ID"
                className="hover:text-[#111111] transition-colors"
              >
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#888888]" />
                )}
              </button>
              <ExternalLink className="w-3.5 h-3.5 text-[#888888] hover:text-[#111111] cursor-pointer" />
              <Maximize2 className="w-3.5 h-3.5 text-[#888888] hover:text-[#111111] cursor-pointer" />
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#F4F4F5] text-[#888888] hover:text-[#111111] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Side-by-side Body (Image 5) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Conversation Turns + Audio Player (7 cols) */}
          <div className="lg:col-span-7 flex flex-col border-r border-[#EAEAEA] bg-white overflow-hidden">
            {/* Turns Scroll Area */}
            <div className="p-6 flex-1 overflow-y-auto max-h-[calc(92vh-190px)] space-y-4">
              {/* Initiation status pill */}
              <div className="flex justify-center">
                <span className="px-3 py-1 rounded-full bg-[#F4F4F5] border border-[#EAEAEA] text-[11px] text-[#666666] font-medium flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-[#888888]" />
                  Conversation Initiated
                </span>
              </div>

              {/* Message turns with play buttons on every turn */}
              <div className="space-y-4 pt-2">
                {transcript.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#888888] space-y-1">
                    <p className="font-medium text-[#444444]">No audio transcript recorded</p>
                    <p className="text-[11px] text-[#888888]">
                      This telephony attempt does not have turn-by-turn speech messages stored.
                    </p>
                  </div>
                ) : (
                  transcript.map((turn, idx) => {
                    const isAgent = turn.role === "agent" || turn.role === "assistant";
                    const isSelected = selectedTurnIdx === idx;

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedTurnIdx(idx)}
                        className={`flex items-start gap-2.5 cursor-pointer ${
                          isAgent ? "justify-start" : "justify-end"
                        }`}
                      >
                        {/* Agent turn: Play button on left */}
                        {isAgent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTurnIdx(idx);
                              togglePlay();
                            }}
                            className="w-5 h-5 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#444444] flex items-center justify-center text-[10px] shrink-0 mt-1"
                          >
                            <Play className="w-2.5 h-2.5 fill-current ml-0.2" />
                          </button>
                        )}

                        {/* Speech Bubble */}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed transition-all ${
                            isAgent
                              ? isSelected
                                ? "bg-[#F3F4F6] text-[#111111] ring-1 ring-[#D1D5DB]"
                                : "bg-[#F9FAFB] text-[#222222] border border-[#EAEAEA]"
                              : isSelected
                              ? "bg-[#F3F4F6] text-[#111111] ring-1 ring-[#D1D5DB]"
                              : "bg-[#F9FAFB] text-[#222222] border border-[#EAEAEA]"
                          }`}
                        >
                          <p>{turn.text}</p>
                        </div>

                        {/* User turn: Play button on right */}
                        {!isAgent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTurnIdx(idx);
                              togglePlay();
                            }}
                            className="w-5 h-5 rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#444444] flex items-center justify-center text-[10px] shrink-0 mt-1"
                          >
                            <Play className="w-2.5 h-2.5 fill-current ml-0.2" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Persistent Audio Player at Bottom (Matching Image 5) */}
            <div className="p-4 border-t border-[#EAEAEA] bg-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="w-8 h-8 rounded-full bg-[#111111] hover:bg-[#333333] text-white flex items-center justify-center transition-all shadow-sm"
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>

                {/* Waveform Scrubber Simulation */}
                <div className="flex items-center gap-1 h-6">
                  {Array.from({ length: 32 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all ${
                        i < 12
                          ? "bg-[#111111] h-4"
                          : i < 20
                          ? "bg-[#D1D5DB] h-5"
                          : "bg-[#E5E7EB] h-2.5"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-[#666666] font-mono">
                <span>
                  {formatTimer(currentTime)} / {formatTimer(durationSec)}
                </span>

                {/* Speed toggle */}
                <button
                  onClick={handleSpeedCycle}
                  className="px-2 py-0.5 rounded-md hover:bg-[#F3F4F6] font-semibold text-[#111111]"
                >
                  {playbackSpeed}x
                </button>

                <Volume2 className="w-4 h-4 text-[#888888] cursor-pointer" />
                <Download className="w-4 h-4 text-[#888888] cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Right Column: Telemetry + Anyash Health Decision (5 cols) */}
          <div className="lg:col-span-5 bg-[#FAFAFC] flex flex-col overflow-hidden">
            {/* Sub-tabs on Right */}
            <div className="px-6 py-3 border-b border-[#EAEAEA] flex items-center justify-between bg-white">
              <div className="flex items-center gap-4 text-xs font-medium">
                <button
                  onClick={() => setActiveRightTab("decision")}
                  className={`pb-1 transition-all ${
                    activeRightTab === "decision"
                      ? "text-[#0071E3] border-b-2 border-[#0071E3] font-semibold"
                      : "text-[#666666] hover:text-[#111111]"
                  }`}
                >
                  Anyash Care Decision
                </button>
                <button
                  onClick={() => setActiveRightTab("telemetry")}
                  className={`pb-1 transition-all ${
                    activeRightTab === "telemetry"
                      ? "text-[#111111] border-b-2 border-[#111111] font-semibold"
                      : "text-[#666666] hover:text-[#111111]"
                  }`}
                >
                  Voice & TTS Telemetry
                </button>
              </div>

              <button className="text-[11px] text-[#666666] hover:text-[#111111] flex items-center gap-1 font-mono">
                <span>Transliterate</span>
                <span className="font-serif">æ</span>
              </button>
            </div>

            {/* Right Pane Content */}
            <div className="p-6 flex-1 overflow-y-auto max-h-[calc(92vh-190px)] space-y-4">
              {/* TAB 1: Anyash Care Decision */}
              {activeRightTab === "decision" && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl p-5 border border-[#EAEAEA] shadow-sm space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                        Clinical Triage Decision
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3.5 h-3.5" />
                          {decisionType}
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${
                          Number(call.number_of_calls || call.rawAgentVariables?.number_of_calls || 1) <= 1
                            ? "bg-blue-50 text-[#0071E3] border-blue-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                        }`}>
                          number_of_calls: {call.number_of_calls || call.rawAgentVariables?.number_of_calls || 1}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#F0F0F0]">
                      <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                        What Happened?
                      </div>
                      <p className="text-[13px] text-[#111111] mt-1 leading-relaxed">
                        {decision?.observation ||
                          call.summary ||
                          `Call attempt recorded for ${parentName}.`}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#F0F0F0]">
                      <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                        Why Anyash Made This Decision
                      </div>
                      <p className="text-[13px] text-[#111111] mt-1 leading-relaxed font-medium">
                        {decision?.why ||
                          "Call completed with normal check-in baseline."}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#F0F0F0]">
                      <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                        Next Action
                      </div>
                      <p className="text-[13px] text-[#0071E3] font-medium mt-1">
                        {decision?.nextAction || "Scheduled care check-in."}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#F0F0F0]">
                      <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                        Family Notification
                      </div>
                      <p className="text-[12px] text-[#666666] mt-1 flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{decision?.familyNotification?.note || "Health timeline logged."}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      if (onCallParent) onCallParent(parentName);
                    }}
                    className="w-full py-2.5 px-4 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call {parentName} Now</span>
                  </button>
                </div>
              )}

              {/* TAB 2: Voice & TTS Telemetry (Image 5 exact) */}
              {activeRightTab === "telemetry" && (
                <div className="space-y-4">
                  {/* AGENT VARIABLES */}
                  <div className="bg-white rounded-xl p-4 border border-[#EAEAEA] shadow-sm space-y-2">
                    <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider flex items-center justify-between">
                      <span>Agent Variables</span>
                      <span className="text-[10px] font-mono text-[#0071E3] font-normal">Sarvam Vobiz v1</span>
                    </div>
                    <div className="text-xs text-[#666666] flex justify-between py-1 border-b border-[#F5F5F5]">
                      <span className="font-mono text-[#111111] font-semibold">number_of_calls</span>
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                        Number(call.number_of_calls || call.rawAgentVariables?.number_of_calls || 1) <= 1
                          ? "bg-blue-100 text-[#0071E3]"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {call.number_of_calls || call.rawAgentVariables?.number_of_calls || 1}
                      </span>
                    </div>
                    <div className="text-xs text-[#666666] flex justify-between">
                      <span>parent_name</span>
                      <span className="text-[#111111] font-medium">{parentName}</span>
                    </div>
                  </div>

                  {/* INPUT */}
                  <div className="bg-white rounded-xl p-4 border border-[#EAEAEA] shadow-sm space-y-2">
                    <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                      Input
                    </div>
                    <div className="text-xs text-[#666666] flex justify-between py-1 border-b border-[#F5F5F5]">
                      <span>Text</span>
                      <span className="text-[#111111] font-medium text-right max-w-[240px]">
                        {selectedTurn.text}
                      </span>
                    </div>
                    <div className="text-xs text-[#666666] flex justify-between">
                      <span>Language</span>
                      <span className="text-[#111111] font-mono">hi-IN</span>
                    </div>
                  </div>

                  {/* OUTPUT */}
                  <div className="bg-white rounded-xl p-4 border border-[#EAEAEA] shadow-sm space-y-2">
                    <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                      Output
                    </div>
                    <div className="text-xs text-[#666666] flex justify-between">
                      <span>Text</span>
                      <span className="text-[#111111] font-medium text-right max-w-[240px]">
                        {selectedTurn.text}
                      </span>
                    </div>
                  </div>

                  {/* TTS */}
                  <div className="bg-white rounded-xl p-4 border border-[#EAEAEA] shadow-sm space-y-2">
                    <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-[#111111]" />
                      <span>TTS</span>
                    </div>
                    <div className="text-xs text-[#666666] flex justify-between py-1 border-b border-[#F5F5F5]">
                      <span>Text</span>
                      <span className="text-[#111111] font-medium text-right max-w-[240px]">
                        {selectedTurn.text}
                      </span>
                    </div>
                    <div className="text-xs text-[#666666] flex justify-between py-1 border-b border-[#F5F5F5] items-center">
                      <span>Audio</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={togglePlay}
                          className="w-5 h-5 rounded-full bg-[#111111] text-white flex items-center justify-center text-[9px]"
                        >
                          <Play className="w-2.5 h-2.5 fill-current ml-0.2" />
                        </button>
                        <div className="w-16 h-3 bg-[#E5E7EB] rounded-full" />
                      </div>
                    </div>
                    <div className="text-xs text-[#666666] flex justify-between py-1 border-b border-[#F5F5F5]">
                      <span>Language</span>
                      <span className="text-[#111111] font-mono">hi-IN</span>
                    </div>
                    <div className="text-xs text-[#666666] flex justify-between">
                      <span>Speaker</span>
                      <span className="text-[#111111] font-mono">shubh</span>
                    </div>
                  </div>

                  {/* VOICE SETTINGS */}
                  <div className="bg-white rounded-xl p-4 border border-[#EAEAEA] shadow-sm space-y-3">
                    <div className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider">
                      Voice Settings
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
                        <span className="text-[#666666]">Pitch</span>
                        <span className="font-mono text-[#111111]">0</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#F5F5F5]">
                        <span className="text-[#666666]">Pace</span>
                        <span className="font-mono text-[#111111]">1</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[#666666]">Style</span>
                        <span className="font-mono text-[#111111]">0.5</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[#666666]">Speed</span>
                        <span className="font-mono text-[#111111]">1</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
