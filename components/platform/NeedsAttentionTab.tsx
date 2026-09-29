"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Phone,
  Eye,
  CheckCircle,
  Send,
  Calendar,
  Sparkles,
} from "lucide-react";
import { DecisionCard, ParentProfile, CallRecord } from "@/lib/types";

interface NeedsAttentionTabProps {
  decisions: DecisionCard[];
  parents: ParentProfile[];
  onSelectParent: (parent: ParentProfile) => void;
  onCallParent: (parent: ParentProfile) => void;
  onInspectCall: (decision: DecisionCard) => void;
  onMarkReviewed?: (decisionId: string) => void;
}

export function NeedsAttentionTab({
  decisions,
  parents,
  onSelectParent,
  onCallParent,
  onInspectCall,
  onMarkReviewed,
}: NeedsAttentionTabProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "escalation" | "family" | "monitor">("all");

  const filteredDecisions = decisions.filter((d) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "escalation") return d.decision === "ESCALATION" || d.urgency === "urgent";
    if (activeFilter === "family") return d.decision === "FAMILY_NOTIFICATION";
    if (activeFilter === "monitor") return d.decision === "MONITOR";
    return true;
  });

  const getDecisionBadge = (decision?: string, urgency?: string) => {
    switch (decision) {
      case "ESCALATION":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            ESCALATION · Human Review Required
          </span>
        );
      case "FAMILY_NOTIFICATION":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Send className="w-3 h-3 text-indigo-600" />
            FAMILY NOTIFICATION · Dispatched
          </span>
        );
      case "MONITOR":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            MONITOR · Active Surveillance
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            NORMAL
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0071E3] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-[#111111]">
              Needs Attention — Anyash Responsibility Triage
            </h2>
          </div>
          <p className="text-[13px] text-[#666666] leading-relaxed">
            The control room where Anyash takes operational responsibility for parental follow-ups,
            flagging symptom changes across sequential calls.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-[#F4F4F5] p-1 rounded-xl border border-[#E5E5E5] self-start text-xs">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeFilter === "all"
                ? "bg-white text-[#111111] shadow-sm font-medium"
                : "text-[#666666]"
            }`}
          >
            All ({decisions.length})
          </button>
          <button
            onClick={() => setActiveFilter("escalation")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeFilter === "escalation"
                ? "bg-rose-500 text-white shadow-sm font-medium"
                : "text-[#666666]"
            }`}
          >
            Escalation
          </button>
          <button
            onClick={() => setActiveFilter("family")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeFilter === "family"
                ? "bg-indigo-600 text-white shadow-sm font-medium"
                : "text-[#666666]"
            }`}
          >
            Family Dispatched
          </button>
          <button
            onClick={() => setActiveFilter("monitor")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeFilter === "monitor"
                ? "bg-amber-600 text-white shadow-sm font-medium"
                : "text-[#666666]"
            }`}
          >
            Monitoring
          </button>
        </div>
      </div>

      {/* Decision Cards */}
      <div className="space-y-4">
        {filteredDecisions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#EAEAEA] p-12 text-center shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-100">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-[#111111]">
              All Clear · No Critical Attention Items
            </div>
            <p className="text-xs text-[#777777] max-w-sm mx-auto">
              No active escalations or high-risk medical alerts detected across calls. Routine check-ins are running smoothly.
            </p>
          </div>
        ) : (
          filteredDecisions.map((card) => {
          const parent = parents.find((p) => p.id === card.profileId || p.parentName === card.parentName) || {
            id: card.profileId,
            parentName: card.parentName || "Parent",
            parentPhone: "+91 98765 00000",
            honorific: "Ji",
            preferredLanguage: "Hindi" as const,
            childName: "Family",
            childPhone: "",
            emergencyContact: { name: "", phone: "", relationship: "" },
            knownConditions: [],
            medications: [],
            routines: [],
            activeFollowUps: [],
          };

          return (
            <div
              key={card.id}
              className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4 hover:border-[#D1D5DB] transition-all"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0F0F0]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#F3F4F6] text-[#111111] flex items-center justify-center font-bold text-xs">
                    {parent.parentName.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#111111]">
                        {parent.parentName}
                      </span>
                      <span className="text-xs text-[#777777]">
                        · {card.symptom || "Health Signal"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#888888]">
                      {card.timestamp} · {parent.parentPhone}
                    </p>
                  </div>
                </div>

                {getDecisionBadge(card.decision, card.urgency)}
              </div>

              {/* 5 Pillars Hierarchy */}
              <div className="space-y-3 text-xs leading-relaxed">
                {/* 1. What Happened? */}
                <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#F0F0F0]">
                  <div className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider mb-1">
                    1. What happened?
                  </div>
                  <blockquote className="text-[#111111] italic font-normal">
                    "{card.observation}"
                  </blockquote>
                </div>

                {/* 2 & 3. What Anyash Understood & Decision Rationale */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#F0F0F0]">
                    <div className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider mb-1">
                      2. What did Anyash understand?
                    </div>
                    <p className="text-[#444444]">
                      {card.interpretation}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#F0F0F0]">
                    <div className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider mb-1">
                      3. Decision & Rationale
                    </div>
                    <p className="text-[#111111] font-medium">
                      {card.why || card.recommendedAction}
                    </p>
                  </div>
                </div>

                {/* 4. What happens next? */}
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
                    <div>
                      <span className="font-semibold text-[#0071E3] uppercase text-[10px] mr-1.5">
                        4. Next Action:
                      </span>
                      <span className="text-[#111111] font-medium">
                        {card.nextAction || card.recommendedAction}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#666666]">
                    {card.familyNotification?.sent ? (
                      <span className="text-emerald-700 flex items-center gap-1 font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Family Notified ({card.familyNotification.channel || "WhatsApp"})
                      </span>
                    ) : (
                      <span>Family: {card.familyNotification?.note || "Not sent"}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 flex items-center justify-between border-t border-[#F0F0F0]">
                <button
                  onClick={() => onInspectCall(card)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#0071E3] hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>5. Inspect Full Conversation & Log Analyser</span>
                </button>

                <button
                  onClick={() => onCallParent(parent)}
                  className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Phone className="w-3 h-3" />
                  <span>Call {parent.parentName.split(" ")[0]} Now</span>
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
    </div>
  );
}
