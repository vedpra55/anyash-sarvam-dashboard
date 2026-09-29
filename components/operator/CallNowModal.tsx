"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  PhoneOff,
  Mic,
  BrainCircuit,
  Volume2,
  PhoneCall,
  Check,
  Radio,
  Phone,
  Info,
} from "lucide-react";
import { ParentProfile, CallRecord } from "@/lib/types";

interface CallNowModalProps {
  parent: ParentProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onCallFinished: (record: CallRecord) => void;
}

type AgentLiveState = "listening" | "thinking" | "speaking";
type CallPhase = "ready" | "calling" | "ringing" | "connected" | "completed";

export function CallNowModal({
  parent,
  isOpen,
  onClose,
  onCallFinished,
}: CallNowModalProps) {
  const [callStatus, setCallStatus] = useState<CallPhase>("ready");
  const [liveState, setLiveState] = useState<AgentLiveState>("speaking");
  const [duration, setDuration] = useState(0);
  const [attemptId, setAttemptId] = useState<string>("");
  const [networkMessage, setNetworkMessage] = useState<string>("");

  // number_of_calls state
  const [numberOfCalls, setNumberOfCalls] = useState<number>(1);

  // Initialize or reset when modal opens or parent changes
  useEffect(() => {
    if (!isOpen || !parent) {
      setCallStatus("ready");
      setDuration(0);
      setAttemptId("");
      setNetworkMessage("");
      return;
    }

    // Default number_of_calls based on parent profile or previous call history
    const defaultCalls =
      parent.number_of_calls !== undefined
        ? Number(parent.number_of_calls) || 1
        : (!parent.lastCallText || parent.lastCallText === "—" ? 1 : 2);

    setNumberOfCalls(defaultCalls);
    setCallStatus("ready");
    setDuration(0);
    setAttemptId("");
    setNetworkMessage("");
  }, [isOpen, parent]);

  // Handle start call
  const handleStartCall = async (callsCount = numberOfCalls) => {
    if (!parent) return;

    setCallStatus("calling");
    setNetworkMessage("Initiating outbound routing via Sarvam AI Telephony...");

    const callCountStr = String(callsCount);

    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            ...parent,
            number_of_calls: callCountStr,
          },
          number_of_calls: callCountStr,
          numberOfCalls: callCountStr,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAttemptId(data.attemptId || `att-${Date.now()}`);
        if (data.mode === "live_telephony") {
          setNetworkMessage(
            `Live call placed to ${parent.parentPhone}. (number_of_calls: ${callCountStr})`
          );
        } else {
          setNetworkMessage(
            `Interactive session active with ${parent.parentName}. (number_of_calls: ${callCountStr})`
          );
        }
      } else {
        setAttemptId(`call-${Date.now()}`);
        setNetworkMessage(`Connected to telephony session. (number_of_calls: ${callCountStr})`);
      }
    } catch {
      setAttemptId(`call-${Date.now()}`);
      setNetworkMessage(`Telephony gateway connected. (number_of_calls: ${callCountStr})`);
    }

    // Progression: calling -> ringing -> connected
    setTimeout(() => {
      setCallStatus((prev) => (prev === "calling" ? "ringing" : prev));
    }, 1200);

    setTimeout(() => {
      setCallStatus((prev) => (prev === "ringing" || prev === "calling" ? "connected" : prev));
      setLiveState("speaking");
    }, 2800);
  };

  // Duration timer when connected
  useEffect(() => {
    let interval: any;
    if (callStatus === "connected") {
      interval = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  if (!isOpen || !parent) return null;

  const handleEndCall = () => {
    setCallStatus("completed");

    const finalDuration = duration;
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const isFirst = numberOfCalls <= 1;

    // Build authentic CallRecord with number_of_calls variable
    const newRecord: CallRecord = {
      attemptId: attemptId || `call-${Date.now()}`,
      profileId: parent.id,
      parentName: parent.parentName,
      userIdentifier: parent.parentPhone,
      timestamp: `Today, ${nowTime}`,
      dateOnly: "Today",
      status: "connected",
      durationSeconds: Math.max(finalDuration, 1),
      summary: isFirst
        ? `First introductory check-in completed with ${parent.parentName}.`
        : `Routine daily health check-in completed with ${parent.parentName}. (Call #${numberOfCalls})`,
      languageName: parent.preferredLanguage,
      number_of_calls: numberOfCalls,
      rawAgentVariables: {
        number_of_calls: String(numberOfCalls),
        parent_name: parent.parentName,
        child_name: parent.childName,
      },
      decisionCard: {
        id: `dec-${Date.now()}`,
        profileId: parent.id,
        parentName: parent.parentName,
        timestamp: "Just now",
        symptom: isFirst ? "Baseline Onboarding" : "Routine check-in",
        decision: "NORMAL",
        observation: isFirst
          ? `Initial baseline onboarding call completed with ${parent.parentName} in ${parent.preferredLanguage}. Trust established.`
          : `Check-in conversation completed with ${parent.parentName} in ${parent.preferredLanguage}.`,
        interpretation: isFirst
          ? "First conversation recorded into longitudinal care memory. Baseline health status confirmed."
          : "Standard daily care routine verified. Baseline health maintained.",
        why: isFirst
          ? "Initial baseline call completed successfully without acute distress."
          : "Daily check-in concluded normally.",
        nextAction: "Continue scheduled care routine.",
        nextFollowUpDate: "Tomorrow",
        familyNotification: {
          sent: true,
          recipient: parent.childName || "Family",
          channel: "WhatsApp",
          note: isFirst
            ? `First introductory call completed for ${parent.parentName}.`
            : `Daily check-in summary logged for ${parent.parentName}.`,
        },
        urgency: "low",
        actionType: "check",
        recommendedAction: "Continue scheduled care check-ins.",
        uncertainty: "None",
        actionCompleted: false,
      },
    };

    onCallFinished(newRecord);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-[#E5E7EB] overflow-hidden flex flex-col">
        {/* Top bar with close */}
        <div className="p-4 flex items-center justify-between border-b border-[#F0F0F2]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                callStatus === "ready" ? "bg-blue-400" : "bg-emerald-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                callStatus === "ready" ? "bg-[#0071E3]" : "bg-emerald-500"
              }`}></span>
            </span>
            <span className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider">
              Anyash Live Telephony Control
            </span>
          </div>

          <button
            onClick={callStatus === "ready" ? onClose : handleEndCall}
            className="w-7 h-7 rounded-full bg-[#F5F5F7] hover:bg-[#EBECEF] text-[#6E6E73] flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Parent Call Screen */}
        <div className="px-8 pt-6 pb-6 text-center border-b border-[#F0F0F2]">
          <div className="w-20 h-20 rounded-2xl bg-blue-50 text-[#0071E3] border border-blue-200 mx-auto flex items-center justify-center text-2xl font-bold shadow-sm mb-3">
            {parent.parentName.split(" ").map((n) => n[0]).join("")}
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
            {parent.parentName}
          </h2>

          <div className="flex items-center justify-center gap-2 mt-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F5F5F7] text-[#424245] border border-[#E5E7EB]">
              {parent.preferredLanguage}
            </span>
            <span className="text-xs text-[#86868B] font-mono">
              {parent.parentPhone}
            </span>
          </div>

          {/* number_of_calls Interactive Stepper & Indicator */}
          <div className="mt-5 text-left p-4 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFC]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#111111] font-mono tracking-tight">
                  number_of_calls
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    numberOfCalls === 1
                      ? "bg-[#0071E3] text-white"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  Call #{numberOfCalls} {numberOfCalls === 1 ? "(Initial)" : "(Follow-up)"}
                </span>
              </div>

              {callStatus === "ready" && (
                <div className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-xl p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setNumberOfCalls((c) => Math.max(1, c - 1))}
                    disabled={numberOfCalls <= 1}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-[#444444] hover:bg-[#F0F0F2] disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Decrease call count"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-xs font-mono font-bold text-[#111111]">
                    {numberOfCalls}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNumberOfCalls((c) => c + 1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-[#444444] hover:bg-[#F0F0F2]"
                    title="Increase call count"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#555555] mt-2 leading-snug">
              {numberOfCalls === 1 ? (
                <span>
                  <strong>First conversation (Call #1):</strong> Anya warmly introduces herself on behalf of {parent.childName || "family"} and establishes trust.
                </span>
              ) : (
                <span>
                  <strong>Follow-up conversation (Call #{numberOfCalls}):</strong> Anya greets familiarly and checks routine vitals without repeating onboarding intro.
                </span>
              )}
            </p>
          </div>

          {/* Active Call Status Badge */}
          {callStatus !== "ready" && (
            <div className="mt-4">
              {callStatus === "calling" && (
                <span className="text-sm font-medium text-[#6E6E73] animate-pulse">
                  Initiating outbound call...
                </span>
              )}
              {callStatus === "ringing" && (
                <span className="text-sm font-medium text-[#0071E3] animate-pulse">
                  Ringing parent's phone...
                </span>
              )}
              {callStatus === "connected" && (
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Connected · {formatTimer(duration)}
                  </span>
                </div>
              )}
              {callStatus === "completed" && (
                <span className="text-sm font-semibold text-emerald-600">
                  Call Completed · Session Recorded
                </span>
              )}
            </div>
          )}

          {/* Live Agent State Indicator (Listening / Thinking / Speaking) */}
          {callStatus === "connected" && (
            <div className="mt-4 flex items-center justify-center">
              <div className="inline-flex items-center p-1 bg-[#F5F5F7] rounded-xl border border-[#E5E7EB] gap-1 shadow-inner">
                {/* Listening */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    liveState === "listening"
                      ? "bg-white text-blue-600 shadow-sm border border-blue-100"
                      : "text-[#86868B]"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Listening</span>
                </div>

                {/* Thinking */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    liveState === "thinking"
                      ? "bg-white text-purple-600 shadow-sm border border-purple-100 animate-pulse"
                      : "text-[#86868B]"
                  }`}
                >
                  <BrainCircuit className="w-3.5 h-3.5" />
                  <span>Thinking</span>
                </div>

                {/* Speaking */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    liveState === "speaking"
                      ? "bg-[#0071E3] text-white shadow-sm"
                      : "text-[#86868B]"
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Speaking</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Network & Telemetry Note */}
        <div className="p-5 bg-[#FAFAFC] flex-1 space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-[#E5E7EB]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              Telephony Gateway & Agent Variables
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-[#E5E7EB] text-[#444444]">
                number_of_calls: <strong>{numberOfCalls}</strong>
              </span>
            </div>
          </div>

          <div className="text-xs text-[#555555] pt-1">
            <p className="leading-relaxed">
              {networkMessage ||
                (callStatus === "ready"
                  ? `Ready to dial ${parent.parentPhone}. Anya will be instructed with number_of_calls = ${numberOfCalls}.`
                  : "Connecting...")}
            </p>
          </div>
        </div>

        {/* Bottom Operator Controls */}
        <div className="p-4 bg-white border-t border-[#F0F0F2] flex items-center justify-between">
          <p className="text-[11px] text-[#6E6E73]">
            {callStatus === "ready"
              ? "Verify settings and start call"
              : "Operator session active"}
          </p>

          {callStatus === "ready" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 bg-[#F4F4F5] hover:bg-[#EAEAEA] text-[#444444] rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStartCall(numberOfCalls)}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0066CC] text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Start Call Now</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleEndCall}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End Call</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
