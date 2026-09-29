"use client";

import React, { useState } from "react";
import {
  PhoneCall,
  Clock,
  Calendar,
  Search,
  Eye,
  CheckCircle2,
  AlertCircle,
  PhoneForwarded,
} from "lucide-react";
import { CallRecord } from "@/lib/types";

interface CallsViewProps {
  calls: CallRecord[];
  onViewCall: (call: CallRecord) => void;
  onQuickCall?: (parentName?: string) => void;
}

export function CallsView({ calls, onViewCall, onQuickCall }: CallsViewProps) {
  const [filter, setFilter] = useState<"all" | "connected" | "flagged">("all");

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const filteredCalls = calls.filter((c) => {
    if (filter === "all") return true;
    if (filter === "connected") return c.status === "connected";
    if (filter === "flagged") {
      const dec = c.decisionCard?.decision;
      return dec === "MONITOR" || dec === "FAMILY_NOTIFICATION" || dec === "ESCALATION";
    }
    return true;
  });

  const getDecisionBadge = (decision?: string) => {
    switch (decision) {
      case "ESCALATION":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Escalation
          </span>
        );
      case "FAMILY_NOTIFICATION":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Family Alert
          </span>
        );
      case "MONITOR":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Monitor
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Normal
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-apple-card overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-6 border-b border-[#F0F0F2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1D1D1F]">
              Call Logs & Recordings
            </h2>
            <p className="text-[12px] text-[#6E6E73] mt-0.5">
              Comprehensive telemetry of outbound check-in calls and memory sync
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#F5F5F7] p-1 rounded-xl border border-[#E5E7EB]">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filter === "all"
                  ? "bg-white text-[#1D1D1F] shadow-sm"
                  : "text-[#6E6E73]"
              }`}
            >
              All Calls ({calls.length})
            </button>
            <button
              onClick={() => setFilter("connected")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filter === "connected"
                  ? "bg-white text-[#1D1D1F] shadow-sm"
                  : "text-[#6E6E73]"
              }`}
            >
              Connected
            </button>
            <button
              onClick={() => setFilter("flagged")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filter === "flagged"
                  ? "bg-white text-[#1D1D1F] shadow-sm"
                  : "text-[#6E6E73]"
              }`}
            >
              Flagged Decisions
            </button>
          </div>
        </div>

        {/* Calls Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FBFBFC] text-[#6E6E73] text-[11px] font-semibold uppercase tracking-wider">
                <th className="py-3 px-6">Parent</th>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4 text-right">Duration</th>
                <th className="py-3 px-6">Summary / Memory Signal</th>
                <th className="py-3 px-4">Decision</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F2]">
              {filteredCalls.map((call) => {
                const decisionType =
                  call.decisionCard?.decision ||
                  (call.summary?.toLowerCase().includes("knee")
                    ? "MONITOR"
                    : call.summary?.toLowerCase().includes("dizziness")
                    ? "FAMILY_NOTIFICATION"
                    : "NORMAL");

                return (
                  <tr
                    key={call.attemptId}
                    className="hover:bg-[#F9F9FB] transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold text-[#1D1D1F]">
                      {call.parentName || "Parent"}
                    </td>
                    <td className="py-4 px-4 text-[#424245]">
                      {call.timestamp}
                    </td>
                    <td className="py-4 px-4 text-right text-[#424245] font-mono text-xs">
                      {formatDuration(call.durationSeconds)}
                    </td>
                    <td className="py-4 px-6 text-[#1D1D1F]">
                      <span className="font-medium">{call.summary || "Call completed"}</span>
                    </td>
                    <td className="py-4 px-4">
                      {getDecisionBadge(decisionType)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => onViewCall(call)}
                        className="px-3.5 py-1.5 bg-[#F5F5F7] hover:bg-[#EBECEF] active:bg-[#E2E4E8] text-[#0071E3] font-medium rounded-lg text-xs transition-all border border-[#E5E7EB]"
                      >
                        Inspect Call
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
