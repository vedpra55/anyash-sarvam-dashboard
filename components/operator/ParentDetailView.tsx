"use client";

import React from "react";
import {
  Phone,
  ArrowLeft,
  Calendar,
  Clock,
  Pill,
  Heart,
  AlertCircle,
  CheckCircle2,
  FileText,
  Activity,
  User,
  Shield,
  Send,
  Pencil,
} from "lucide-react";
import { ParentProfile, CallRecord } from "@/lib/types";

interface ParentDetailViewProps {
  parent: ParentProfile;
  calls: CallRecord[];
  onBack: () => void;
  onCallParent: (parent: ParentProfile) => void;
  onViewCall: (call: CallRecord) => void;
  onEditParent?: (parent: ParentProfile) => void;
}

export function ParentDetailView({
  parent,
  calls,
  onBack,
  onCallParent,
  onViewCall,
  onEditParent,
}: ParentDetailViewProps) {
  const parentCalls = calls.filter((c) => {
    if (c.profileId === parent.id) return true;
    if (c.parentName && c.parentName.trim().toLowerCase() === parent.parentName.trim().toLowerCase()) return true;
    if (c.userIdentifier) {
      const cleanCallPhone = c.userIdentifier.replace(/\D/g, "");
      const cleanParentPhone = parent.parentPhone.replace(/\D/g, "");
      if (cleanCallPhone.length >= 10 && cleanParentPhone.length >= 10) {
        if (cleanCallPhone.slice(-10) === cleanParentPhone.slice(-10)) return true;
      }
    }
    return false;
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const getDecisionBadge = (decision?: string) => {
    switch (decision) {
      case "ESCALATION":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Escalation
          </span>
        );
      case "FAMILY_NOTIFICATION":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Family Alert
          </span>
        );
      case "MONITOR":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Monitor
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Normal
          </span>
        );
    }
  };

  const isConcernDetected =
    Boolean(parent.riskFollowUp &&
    parent.riskFollowUp !== "None" &&
    parent.riskFollowUp !== "—");

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F4F4F5] border border-[#E5E5E5] text-xs font-medium text-[#444444] hover:text-[#111111] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Parents Directory</span>
        </button>
      </div>

      {/* 1. Header with Status, Edit & Apple blue Call Now button */}
      <div className="bg-white rounded-2xl p-6 border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-[#0071E3] flex items-center justify-center font-bold text-xl shadow-sm">
            {parent.parentName.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-[#111111]">
                {parent.parentName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {parent.status || "Active"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-50 text-[#0071E3] border border-blue-200">
                number_of_calls: {parent.number_of_calls !== undefined ? parent.number_of_calls : (parentCalls.length === 0 ? 1 : parentCalls.length + 1)}
              </span>
            </div>
            <p className="text-xs text-[#666666] font-normal mt-1 flex flex-wrap items-center gap-2">
              <span>{parent.age || 58} yrs</span>
              <span>·</span>
              <span>{parent.preferredLanguage}</span>
              <span>·</span>
              <span>{parent.familyRelation || `Family: ${parent.childName}`}</span>
              <span>·</span>
              <span className="font-mono text-[#444444]">{parent.parentPhone}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {onEditParent && (
            <button
              onClick={() => onEditParent(parent)}
              className="px-4 py-2 bg-[#F4F4F5] hover:bg-[#EAEAEA] text-[#111111] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#E5E5E5]"
            >
              <Pencil className="w-3.5 h-3.5 text-[#666666]" />
              <span>Edit Profile</span>
            </button>
          )}

          <button
            onClick={() => onCallParent(parent)}
            className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0066CC] text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call Now</span>
          </button>
        </div>
      </div>

      {/* 2. Current Status Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#888888]">
            Current Status & Clinical Assessment
          </h2>
          <span className="text-[11px] text-[#888888]">
            Live assessment based on conversation history
          </span>
        </div>

        {isConcernDetected ? (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
                Follow-up required
              </div>
              <blockquote className="text-[14px] font-medium text-amber-950 mt-1">
                "{parent.currentStatusNote}"
              </blockquote>
              <p className="text-[11px] text-amber-800 mt-1">
                Anyash has scheduled a follow-up check during the next call.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">
                Stable
              </div>
              <blockquote className="text-[14px] font-medium text-emerald-950 mt-1">
                "{parent.currentStatusNote || "No concerning change detected"}"
              </blockquote>
              <p className="text-[11px] text-emerald-800 mt-1">
                All vitals, meals, and mobility reports are within normal healthy baselines.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Anyash Long-Term Memory Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Follow-Ups */}
        <div className="bg-white rounded-2xl p-5 border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0071E3]" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888888]">
              Active Follow-ups
            </h3>
          </div>
          <ul className="space-y-2">
            {parent.activeFollowUps && parent.activeFollowUps.length > 0 ? (
              parent.activeFollowUps.map((fu, i) => (
                <li
                  key={i}
                  className="text-xs text-[#111111] p-2.5 rounded-lg bg-[#F8F9FA] border border-[#EFF0F2] flex items-start gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] mt-1.5 shrink-0"></span>
                  <span>{fu}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-[#888888] italic">
                No open follow-ups.
              </li>
            )}
          </ul>
        </div>

        {/* Known Conditions */}
        <div className="bg-white rounded-2xl p-5 border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888888]">
              Tracked Conditions
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {parent.knownConditions && parent.knownConditions.length > 0 ? (
              parent.knownConditions.map((cond, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#F5F5F7] text-[#424245] border border-[#E5E7EB]"
                >
                  {cond}
                </span>
              ))
            ) : (
              <span className="text-xs text-[#888888] italic">
                None reported. Learned adaptively through conversation.
              </span>
            )}
          </div>
        </div>

        {/* Daily Medications */}
        <div className="bg-white rounded-2xl p-5 border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888888]">
              Medications Tracked
            </h3>
          </div>
          <ul className="space-y-2">
            {parent.medications && parent.medications.length > 0 ? (
              parent.medications.map((m) => (
                <li
                  key={m.id}
                  className="text-xs text-[#111111] p-2.5 rounded-lg bg-[#F8F9FA] border border-[#EFF0F2] flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold">{m.name}</span>
                    <span className="text-[#888888] ml-1">({m.timing})</span>
                  </div>
                  <span className="text-[10px] font-medium text-[#666666]">
                    {m.dosage}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-xs text-[#888888] italic">
                No prescription logged.
              </li>
            )}
          </ul>
        </div>

        {/* Emergency & Family Contact */}
        <div className="bg-white rounded-2xl p-5 border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888888]">
              Care Circle & Contact
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-[#F8F9FA] border border-[#EFF0F2]">
              <div className="text-[10px] text-[#888888] uppercase font-semibold">Primary Contact</div>
              <div className="font-medium text-[#111111] mt-0.5">{parent.childName}</div>
              <div className="font-mono text-[11px] text-[#666666]">{parent.childPhone || "Not set"}</div>
            </div>
            {parent.emergencyContact && parent.emergencyContact.phone && (
              <div className="p-2.5 rounded-lg bg-[#F8F9FA] border border-[#EFF0F2]">
                <div className="text-[10px] text-[#888888] uppercase font-semibold">Emergency ({parent.emergencyContact.relationship})</div>
                <div className="font-medium text-[#111111] mt-0.5">{parent.emergencyContact.name}</div>
                <div className="font-mono text-[11px] text-[#666666]">{parent.emergencyContact.phone}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Call History Table (Where Anyash Memory becomes visible) */}
      <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0F0F2] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[#111111]">
              Call History & Recorded Transcripts
            </h2>
            <p className="text-[11px] text-[#666666] mt-0.5">
              Historical interactions, clinical summaries, and autonomous risk decisions
            </p>
          </div>
          <span className="text-xs text-[#888888] font-medium bg-[#F4F4F5] px-2.5 py-1 rounded-lg">
            {parentCalls.length} calls logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#EAEAEA] bg-[#FAFAFA] text-[#666666] text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4 text-right">Duration</th>
                <th className="py-3 px-6">Summary</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F2]">
              {parentCalls.length > 0 ? (
                parentCalls.map((call) => {
                  const decisionType = call.decisionCard?.decision || "NORMAL";

                  return (
                    <tr
                      key={call.attemptId}
                      className="hover:bg-[#F9FAFB] transition-colors"
                    >
                      <td className="py-4 px-6 font-semibold text-[#111111]">
                        {call.dateOnly || call.timestamp.split(",")[0]}
                      </td>
                      <td className="py-4 px-4 text-right text-[#444444] font-mono text-xs">
                        {formatDuration(call.durationSeconds)}
                      </td>
                      <td className="py-4 px-6 text-[#222222]">
                        {call.summary || "Routine check-in call completed"}
                      </td>
                      <td className="py-4 px-4">
                        {getDecisionBadge(decisionType)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => onViewCall(call)}
                          className="px-3 py-1.5 bg-[#F4F4F5] hover:bg-[#EAEAEA] text-[#0071E3] font-semibold rounded-lg text-xs transition-all border border-[#E5E5E5]"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#888888]">
                    No calls recorded yet for {parent.parentName}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
