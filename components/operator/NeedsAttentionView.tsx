"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Phone,
  MessageSquare,
  ChevronRight,
  CheckCircle,
  Eye,
  Send,
  Calendar,
  Sparkles,
} from "lucide-react";
import { DecisionCard, ParentProfile } from "@/lib/types";

interface NeedsAttentionViewProps {
  decisions: DecisionCard[];
  parents: ParentProfile[];
  onSelectParent: (parent: ParentProfile) => void;
  onCallParent: (parent: ParentProfile) => void;
  onInspectCall: (decision: DecisionCard) => void;
  onMarkReviewed?: (decisionId: string) => void;
}

export function NeedsAttentionView({
  decisions,
  parents,
  onSelectParent,
  onCallParent,
  onInspectCall,
  onMarkReviewed,
}: NeedsAttentionViewProps) {
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
      {/* Header Banner: The Philosophy of Operational Responsibility */}
      <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-apple-card relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0071E3] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-[#1D1D1F]">
                Needs Attention — Autonomous Decisions
              </h2>
            </div>
            <p className="text-[13px] text-[#6E6E73] leading-relaxed">
              Anyash does not just record conversations — it takes operational responsibility.
              Below are symptoms, pattern variations, and follow-up commitments Anyash made during today's calls.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[#F5F5F7] p-1 rounded-xl border border-[#E5E7EB] self-start">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeFilter === "all"
                  ? "bg-white text-[#1D1D1F] shadow-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              All ({decisions.length})
            </button>
            <button
              onClick={() => setActiveFilter("escalation")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeFilter === "escalation"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              Escalation
            </button>
            <button
              onClick={() => setActiveFilter("family")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeFilter === "family"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              Family Dispatched
            </button>
            <button
              onClick={() => setActiveFilter("monitor")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeFilter === "monitor"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              Monitoring
            </button>
          </div>
        </div>
      </div>

      {/* Decision Cards List */}
      <div className="space-y-4">
        {filteredDecisions.map((card) => {
          const parent = parents.find((p) => p.id === card.profileId) || {
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
              className="bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#D1D5DB] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-5 pb-4 border-b border-[#F0F0F2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FBFBFC]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-[#E5E7EB] text-[#1D1D1F] flex items-center justify-center font-bold text-sm shadow-apple-sm">
                    {parent.parentName.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        onClick={() => onSelectParent(parent)}
                        className="text-[16px] font-semibold text-[#1D1D1F] hover:text-[#0071E3] transition-colors cursor-pointer"
                      >
                        {parent.parentName}
                      </h3>
                      <span className="text-[13px] font-medium text-[#6E6E73]">
                        · {card.symptom || "Health Signal"}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#86868B]">
                      {parent.familyRelation || `Contact: ${parent.childName}`} · {card.timestamp}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getDecisionBadge(card.decision, card.urgency)}
                </div>
              </div>

              {/* The 5 Pillars Body */}
              <div className="p-6 space-y-4">
                {/* 1. What happened? */}
                <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#EFF0F2]">
                  <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">
                    1. What happened?
                  </div>
                  <blockquote className="text-[14px] text-[#1D1D1F] font-normal italic">
                    "{card.observation}"
                  </blockquote>
                </div>

                {/* 2. What did Anyash understand & 3. What decision did it make? */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#EFF0F2]">
                    <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">
                      2. What did Anyash understand?
                    </div>
                    <p className="text-[13px] text-[#424245] leading-relaxed">
                      {card.interpretation}
                    </p>
                  </div>

                  <div className="bg-[#F8F9FA] rounded-xl p-4 border border-[#EFF0F2]">
                    <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">
                      3. Decision & Rationale
                    </div>
                    <div className="text-[13px] font-medium text-[#1D1D1F] leading-relaxed">
                      <span className="font-semibold text-[#0071E3] uppercase mr-1.5">
                        {card.decision || "DECISION"}:
                      </span>
                      {card.why || card.recommendedAction}
                    </div>
                  </div>
                </div>

                {/* 4. What happens next? */}
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-[#0071E3] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[11px] font-semibold text-[#0071E3] uppercase tracking-wider">
                        4. What happens next?
                      </div>
                      <p className="text-[13px] text-[#1D1D1F] font-medium mt-0.5">
                        {card.nextAction || card.recommendedAction}
                      </p>
                      {card.nextFollowUpDate && (
                        <div className="text-[11px] text-[#6E6E73] mt-0.5">
                          Follow-up date: <strong className="text-[#1D1D1F]">{card.nextFollowUpDate}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Family Notification Status */}
                  <div className="text-left sm:text-right shrink-0">
                    <div className="text-[11px] font-medium text-[#86868B]">
                      Family Notification
                    </div>
                    <div className="text-[12px] font-semibold text-[#1D1D1F] mt-0.5">
                      {card.familyNotification?.sent ? (
                        <span className="text-emerald-700 flex items-center sm:justify-end gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Sent ({card.familyNotification.channel || "WhatsApp"})
                        </span>
                      ) : (
                        <span className="text-[#86868B]">
                          {card.familyNotification?.note || "Not sent"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Controls: 5. Let me inspect the conversation & Actions */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0F0F2]">
                  <button
                    onClick={() => onInspectCall(card)}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#0071E3] hover:text-[#0077ED] transition-colors py-1.5 px-2 rounded-lg hover:bg-blue-50/80"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>5. Inspect Full Conversation & Clinical Note</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2">
                    {onMarkReviewed && (
                      <button
                        onClick={() => onMarkReviewed(card.id)}
                        className="px-3 py-1.5 text-xs font-medium text-[#424245] bg-[#F5F5F7] hover:bg-[#EBECEF] rounded-lg border border-[#E5E7EB] transition-all"
                      >
                        Mark Reviewed
                      </button>
                    )}

                    <button
                      onClick={() => onCallParent(parent)}
                      className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0066CC] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call {parent.parentName.split(" ")[0]} Now</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
