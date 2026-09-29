"use client";

import React from "react";
import {
  X,
  Phone,
  Clock,
  Calendar,
  Send,
  AlertTriangle,
  CheckCircle,
  Play,
  Volume2,
  Sparkles,
  User,
  Bot,
} from "lucide-react";
import { CallRecord } from "@/lib/types";

interface CallDetailModalProps {
  call: CallRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onCallNow?: (parentName?: string) => void;
}

export function CallDetailModal({
  call,
  isOpen,
  onClose,
  onCallNow,
}: CallDetailModalProps) {
  if (!isOpen || !call) return null;

  const decision = call.decisionCard;
  const decisionType =
    decision?.decision ||
    (call.summary?.toLowerCase().includes("knee")
      ? "MONITOR"
      : call.summary?.toLowerCase().includes("dizziness")
      ? "FAMILY_NOTIFICATION"
      : "NORMAL");

  const getDecisionBadge = () => {
    switch (decisionType) {
      case "ESCALATION":
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            ESCALATION
          </div>
        );
      case "FAMILY_NOTIFICATION":
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Send className="w-3.5 h-3.5" />
            FAMILY NOTIFICATION
          </div>
        );
      case "MONITOR":
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            MONITOR
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            NORMAL
          </div>
        );
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-apple-modal border border-[#E5E7EB] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#F0F0F2] flex items-center justify-between bg-[#FBFBFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center font-bold text-sm">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-semibold text-[#1D1D1F]">
                  {call.parentName || "Parent"} · Call Review
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-md bg-[#EFF0F2] text-[#424245] font-medium">
                  {call.dateOnly || call.timestamp}
                </span>
              </div>
              <p className="text-[12px] text-[#6E6E73] mt-0.5 flex items-center gap-2">
                <span>Duration: <strong>{formatDuration(call.durationSeconds)}</strong></span>
                <span>·</span>
                <span>Outcome: <strong>{call.status}</strong></span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#F2F2F5] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Side-by-side Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Conversation Transcript (7 cols) */}
          <div className="lg:col-span-7 p-6 border-r border-[#F0F0F2] overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0F0F2]">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                  Conversation Transcript
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-[#0071E3] font-medium">
                  Sarvam Hindi
                </span>
              </div>

              {/* Audio recording player simulation */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5F5F7] border border-[#E5E7EB] text-xs text-[#424245]">
                <Play className="w-3 h-3 text-[#0071E3] fill-[#0071E3]" />
                <span className="font-mono text-[11px]">Audio Recording</span>
                <Volume2 className="w-3 h-3 text-[#86868B]" />
              </div>
            </div>

            {/* Transcript turns */}
            {call.transcript && call.transcript.length > 0 ? (
              <div className="space-y-3 pt-2">
                {call.transcript.map((turn, idx) => {
                  const isAgent = turn.role === "agent";
                  return (
                    <div
                      key={idx}
                      className={`flex gap-3 ${
                        isAgent ? "justify-start" : "justify-end"
                      }`}
                    >
                      {isAgent && (
                        <div className="w-7 h-7 rounded-full bg-[#0071E3] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                          isAgent
                            ? "bg-[#F0F4FA] text-[#1D1D1F] rounded-tl-sm border border-blue-100"
                            : "bg-[#0071E3] text-white rounded-tr-sm"
                        }`}
                      >
                        <div
                          className={`text-[10px] font-semibold mb-1 ${
                            isAgent ? "text-[#0071E3]" : "text-blue-100"
                          }`}
                        >
                          {isAgent ? "Anyash Agent" : call.parentName || "Parent"}
                          {turn.timestamp && (
                            <span className="ml-1.5 opacity-70 font-normal">
                              {turn.timestamp}
                            </span>
                          )}
                        </div>
                        <p>{turn.text}</p>
                      </div>
                      {!isAgent && (
                        <div className="w-7 h-7 rounded-full bg-[#EFF0F2] text-[#1D1D1F] border border-[#E5E7EB] flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                          <User className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-[#86868B] text-xs">
                No transcript turns captured for this attempt.
              </div>
            )}
          </div>

          {/* Right Column: Anyash Decision & Action (5 cols) */}
          <div className="lg:col-span-5 p-6 bg-[#FAFAFC] overflow-y-auto max-h-[calc(90vh-140px)] space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB]">
              <Sparkles className="w-4 h-4 text-[#0071E3]" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                Anyash Autonomous Decision
              </h3>
            </div>

            {/* Decision Hero Pill */}
            <div className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-apple-card space-y-4">
              <div>
                <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">
                  Clinical Triage Decision
                </div>
                {getDecisionBadge()}
              </div>

              {/* Why: */}
              <div className="pt-2 border-t border-[#F0F0F2]">
                <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                  Why Anyash made this decision
                </div>
                <p className="text-[13px] font-medium text-[#1D1D1F] mt-1 leading-relaxed">
                  {decision?.why ||
                    decision?.interpretation ||
                    (decisionType === "MONITOR"
                      ? "New knee pain reported; no severe symptoms reported."
                      : decisionType === "FAMILY_NOTIFICATION"
                      ? "Repeated symptom across 2 days (dizziness reported on both days)."
                      : "Standard check-in completed. Stable vitals and normal diet routine.")}
                </p>
              </div>

              {/* Next Action: */}
              <div className="pt-2 border-t border-[#F0F0F2]">
                <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                  Next Scheduled Action
                </div>
                <p className="text-[13px] font-medium text-[#0071E3] mt-1 leading-relaxed">
                  {decision?.nextAction ||
                    decision?.recommendedAction ||
                    "Follow up tomorrow during morning call."}
                </p>
                {decision?.nextFollowUpDate && (
                  <div className="text-[11px] text-[#6E6E73] mt-1">
                    Scheduled date: <strong>{decision.nextFollowUpDate}</strong>
                  </div>
                )}
              </div>

              {/* Family Notification: */}
              <div className="pt-2 border-t border-[#F0F0F2]">
                <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                  Family Notification
                </div>
                <p className="text-[13px] font-medium text-[#1D1D1F] mt-1">
                  {decision?.familyNotification?.sent ? (
                    <span className="text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Dispatched via {decision.familyNotification.channel || "WhatsApp"}
                    </span>
                  ) : (
                    <span className="text-[#6E6E73]">
                      {decision?.familyNotification?.note || "Not sent (sub-threshold for immediate alert)"}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Operator Actions */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  onClose();
                  if (onCallNow) onCallNow(call.parentName);
                }}
                className="w-full py-2.5 px-4 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0066CC] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call {call.parentName?.split(" ")[0] || "Parent"} Again</span>
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 px-4 bg-white hover:bg-[#F5F5F7] text-[#424245] border border-[#E5E7EB] rounded-xl text-xs font-medium transition-all"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
