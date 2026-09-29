"use client";

import React, { useState, useEffect } from "react";
import { ParentProfile, SupportedLanguage, VoiceHealthConfig, CallRecord } from "@/lib/types";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  Volume2,
  Globe,
  Radio,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface CallTriggerCardProps {
  profile: ParentProfile;
  config: VoiceHealthConfig;
  onCallInitiated: (attemptId: string, language: SupportedLanguage) => void;
  onCallSynced: (call: CallRecord) => void;
  onSimulateCompleted?: (transcript: { role: "agent" | "user"; text: string }[]) => void;
  onToggleWebSimulator: () => void;
  isWebSimulatorActive: boolean;
}

export function CallTriggerCard({
  profile,
  config,
  onCallInitiated,
  onCallSynced,
  onSimulateCompleted,
  onToggleWebSimulator,
  isWebSimulatorActive,
}: CallTriggerCardProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    profile.preferredLanguage
  );
  const [callState, setCallState] = useState<
    "idle" | "calling" | "connected" | "analyzing"
  >("idle");
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [syncStatus, setSyncStatus] = useState<string>("");

  useEffect(() => {
    setSelectedLanguage(profile.preferredLanguage);
  }, [profile]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callState === "connected") {
      timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(timer);
  }, [callState]);

  const handleStartCall = async () => {
    setCallState("calling");
    setSyncStatus("Connecting via Sarvam Telephony...");

    try {
      const callCount =
        profile.number_of_calls !== undefined
          ? Number(profile.number_of_calls) || 1
          : (!profile.lastCallText || profile.lastCallText === "—" ? 1 : 2);
      const callCountStr = String(callCount);

      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            ...profile,
            number_of_calls: callCountStr,
          },
          config,
          customLanguage: selectedLanguage,
          number_of_calls: callCountStr,
          numberOfCalls: callCountStr,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger call");
      }

      setActiveAttemptId(data.attemptId);
      onCallInitiated(data.attemptId, selectedLanguage);

      // Transition to connected state
      setTimeout(() => {
        setCallState("connected");
      }, 2000);
    } catch (err: any) {
      alert(`Call failed: ${err.message}`);
      setCallState("idle");
    }
  };

  const handleEndCallAndSync = async () => {
    setCallState("analyzing");
    setSyncStatus("Fetching live transcript & audio from Sarvam...");

    try {
      // Retry sync up to 4 times with a 2-second delay to give Sarvam time to transcribe
      let foundCall: CallRecord | null = null;

      for (let attempt = 1; attempt <= 4; attempt++) {
        setSyncStatus(`Syncing conversation from Sarvam (Attempt ${attempt}/4)...`);
        const res = await fetch("/api/calls/sync");
        if (res.ok) {
          const data = await res.json();
          if (data.calls && data.calls.length > 0) {
            // Find the matching attempt or the latest call
            if (activeAttemptId) {
              const matched = data.calls.find(
                (c: CallRecord) => c.attemptId === activeAttemptId
              );
              if (matched && matched.transcript && matched.transcript.length > 0) {
                foundCall = matched;
                break;
              }
            }
            // Fallback to latest connected call if matching specific ID is still processing
            const latestConnected = data.calls.find(
              (c: CallRecord) => c.status === "connected" && c.transcript && c.transcript.length > 0
            );
            if (latestConnected) {
              foundCall = latestConnected;
              break;
            }
          }
        }
        await new Promise((r) => setTimeout(r, 2500));
      }

      if (foundCall) {
        onCallSynced(foundCall);
      } else {
        // Trigger a general sync
        const res = await fetch("/api/calls/sync");
        if (res.ok) {
          const data = await res.json();
          if (data.calls?.[0]) {
            onCallSynced(data.calls[0]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to sync call with Sarvam", err);
    } finally {
      setCallState("idle");
      setActiveAttemptId(null);
      setSyncStatus("");
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
  };

  const languages: SupportedLanguage[] = [
    "Hindi",
    "Hinglish",
    "English",
    "Tamil",
    "Telugu",
    "Marathi",
    "Bengali",
  ];

  return (
    <Card className="overflow-hidden border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 shadow-2xl">
      <CardContent className="p-6">
        {/* Top bar: Recipient & Language Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-800/80">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-slate-100">
                {profile.parentName}
              </span>
              <Badge variant="outline" className="text-xs font-mono text-slate-300">
                {profile.parentPhone}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live Sarvam outbound call with Anya Health Agent
            </p>
          </div>

          {/* Language Selector Pills */}
          <div className="flex items-center space-x-1 bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl">
            <Globe className="h-3.5 w-3.5 text-slate-400 ml-1 mr-0.5" />
            {languages.slice(0, 4).map((lang) => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                disabled={callState !== "idle"}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  selectedLanguage === lang
                    ? "bg-teal-500 text-slate-950 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Live Call Status or Trigger Button */}
        <div className="py-8 flex flex-col items-center justify-center text-center">
          {callState === "idle" && (
            <div className="space-y-4 w-full max-w-md">
              <Button
                variant="call"
                size="lg"
                onClick={handleStartCall}
                className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-emerald-500/20 flex items-center justify-center space-x-3 group"
              >
                <div className="h-8 w-8 rounded-xl bg-slate-950/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PhoneCall className="h-5 w-5 text-slate-950" />
                </div>
                <span>Start Check-in Call with {profile.honorific}</span>
              </Button>

              <div className="flex items-center justify-center space-x-4 text-xs text-slate-400">
                <button
                  onClick={onToggleWebSimulator}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                    isWebSimulatorActive
                      ? "bg-teal-500/20 border-teal-500/40 text-teal-300"
                      : "border-slate-800 hover:bg-slate-900 text-slate-400"
                  }`}
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span>{isWebSimulatorActive ? "Hide Web Mic Simulator" : "Try via Browser Mic"}</span>
                </button>
              </div>
            </div>
          )}

          {callState === "calling" && (
            <div className="space-y-3">
              <div className="relative flex items-center justify-center mx-auto">
                <div className="h-20 w-20 rounded-full bg-emerald-500/20 animate-ping absolute" />
                <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                  <PhoneCall className="h-8 w-8 text-slate-950 animate-bounce" />
                </div>
              </div>
              <h4 className="text-base font-semibold text-slate-100">
                Calling {profile.parentPhone}...
              </h4>
              <p className="text-xs text-slate-400">
                Routing call through Sarvam Telephony in {selectedLanguage}
              </p>
            </div>
          )}

          {callState === "connected" && (
            <div className="space-y-4 w-full max-w-sm">
              <div className="flex items-center justify-center space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-semibold text-emerald-400 font-mono">
                  CALL ACTIVE • {formatDuration(duration)}
                </span>
              </div>

              {/* Soundwave animation */}
              <div className="flex items-center justify-center space-x-1.5 h-8 py-1 text-teal-400">
                <span className="soundwave-bar" style={{ animationDelay: "0ms" }} />
                <span className="soundwave-bar" style={{ animationDelay: "150ms" }} />
                <span className="soundwave-bar" style={{ animationDelay: "300ms" }} />
                <span className="soundwave-bar" style={{ animationDelay: "450ms" }} />
                <span className="soundwave-bar" style={{ animationDelay: "200ms" }} />
                <span className="soundwave-bar" style={{ animationDelay: "350ms" }} />
                <span className="soundwave-bar" style={{ animationDelay: "100ms" }} />
              </div>

              <p className="text-xs text-slate-300">
                Anya is speaking with {profile.honorific} on phone {profile.parentPhone}
              </p>

              <Button
                variant="destructive"
                size="default"
                onClick={handleEndCallAndSync}
                className="w-full rounded-xl flex items-center justify-center space-x-2 font-semibold"
              >
                <PhoneOff className="h-4 w-4" />
                <span>End Call & Sync Real Insights</span>
              </Button>
            </div>
          )}

          {callState === "analyzing" && (
            <div className="space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-teal-500/20 flex items-center justify-center mx-auto animate-pulse">
                <Sparkles className="h-6 w-6 text-teal-400" />
              </div>
              <h4 className="text-base font-semibold text-slate-100">
                Syncing Real Call with Sarvam...
              </h4>
              <p className="text-xs text-slate-400">
                {syncStatus || "Extracting actual conversation transcript and health updates"}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
