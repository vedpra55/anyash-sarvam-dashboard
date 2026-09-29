"use client";

import React, { useState } from "react";
import {
  Radio,
  Copy,
  Check,
  Columns,
  Download,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { CallRecord } from "@/lib/types";

interface CallLogsTableTabProps {
  calls: CallRecord[];
  onSelectCall: (call: CallRecord) => void;
}

export function CallLogsTableTab({ calls, onSelectCall }: CallLogsTableTabProps) {
  const [filterMode, setFilterMode] = useState<"connected" | "all">("connected");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredCalls = calls.filter((c) => {
    if (filterMode === "connected") return c.status === "connected";
    return true;
  });

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const formatShortId = (id?: string) => {
    if (!id) return "—";
    if (id.length <= 18) return id;
    return `${id.slice(0, 16)}...`;
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Toolbar */}
      <div className="flex items-center justify-between">
        {/* Sub-filters: Connected | All */}
        <div className="inline-flex items-center p-1 bg-[#F4F4F5] rounded-xl border border-[#E5E5E5] text-xs">
          <button
            onClick={() => setFilterMode("connected")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterMode === "connected"
                ? "bg-white text-[#111111] shadow-sm"
                : "text-[#666666] hover:text-[#111111]"
            }`}
          >
            Connected
          </button>
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              filterMode === "all"
                ? "bg-white text-[#111111] shadow-sm"
                : "text-[#666666] hover:text-[#111111]"
            }`}
          >
            All
          </button>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-1.5">
          <button
            title="Configure columns"
            className="p-1.5 text-[#666666] hover:text-[#111111] hover:bg-[#F4F4F5] rounded-lg border border-[#E5E5E5] transition-colors"
          >
            <Columns className="w-4 h-4" />
          </button>
          <button
            title="Download CSV"
            className="p-1.5 text-[#666666] hover:text-[#111111] hover:bg-[#F4F4F5] rounded-lg border border-[#E5E5E5] transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            title="More options"
            className="p-1.5 text-[#666666] hover:text-[#111111] hover:bg-[#F4F4F5] rounded-lg border border-[#E5E5E5] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table (Matching Image 2) */}
      <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[#EAEAEA] text-[#777777] text-[12px] font-normal">
                <th className="py-3 px-5">Call Type</th>
                <th className="py-3 px-5">Interaction ID</th>
                <th className="py-3 px-5">User identifier</th>
                <th className="py-3 px-5">Duration...</th>
                <th className="py-3 px-5">Usage Cost</th>
                <th className="py-3 px-5">Telephony Cost</th>
                <th className="py-3 px-5">Start Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2F2F2]">
              {filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[#888888]">
                    No call logs recorded yet.
                  </td>
                </tr>
              ) : (
                filteredCalls.map((call) => {
                  const interactionId = call.interactionId || call.attemptId;
                  const userIdentifier = call.userIdentifier || call.parentName || "—";
                  const duration = (call.durationSeconds || 0).toFixed(2);
                  const usageCost =
                    call.usageCostInr !== undefined
                      ? `₹${call.usageCostInr.toFixed(2)}`
                      : "₹0.00";
                  const telephonyCost =
                    call.telephonyCostInr !== undefined
                      ? `₹${call.telephonyCostInr.toFixed(2)}`
                      : "₹0.00";

                  return (
                    <tr
                      key={call.attemptId}
                      onClick={() => onSelectCall(call)}
                      className="hover:bg-[#F9FAFB] transition-colors cursor-pointer group"
                    >
                      {/* Call Type Pill */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#1F2937] text-white">
                            <Radio className="w-2.5 h-2.5 text-rose-400 animate-pulse" />
                            Live Call
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                            Number(call.number_of_calls || call.rawAgentVariables?.number_of_calls || 1) <= 1
                              ? "bg-blue-50 text-[#0071E3] border-blue-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                          }`}>
                            call_#{call.number_of_calls || call.rawAgentVariables?.number_of_calls || 1}
                          </span>
                        </div>
                      </td>

                      {/* Interaction ID + Copy */}
                      <td className="py-4 px-5 font-mono text-xs text-[#222222]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[150px]">
                            {formatShortId(interactionId)}
                          </span>
                          <button
                            onClick={(e) => handleCopy(interactionId, e)}
                            title="Copy Interaction ID"
                            className="opacity-0 group-hover:opacity-100 hover:text-[#0071E3] transition-opacity"
                          >
                            {copiedId === interactionId ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[#888888]" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* User Identifier + Copy */}
                      <td className="py-4 px-5 font-mono text-xs text-[#555555]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[140px]">
                            {formatShortId(userIdentifier)}
                          </span>
                          <button
                            onClick={(e) => handleCopy(userIdentifier, e)}
                            title="Copy User Identifier"
                            className="opacity-0 group-hover:opacity-100 hover:text-[#0071E3] transition-opacity"
                          >
                            {copiedId === userIdentifier ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[#888888]" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Duration in seconds */}
                      <td className="py-4 px-5 text-[#222222] font-medium font-mono text-xs">
                        {duration}
                      </td>

                      {/* Usage Cost */}
                      <td className="py-4 px-5 text-[#222222] font-mono text-xs">
                        {usageCost}
                      </td>

                      {/* Telephony Cost */}
                      <td className="py-4 px-5 text-[#222222] font-mono text-xs">
                        {telephonyCost}
                      </td>

                      {/* Start Time */}
                      <td className="py-4 px-5 text-[#666666] text-xs">
                        {call.timestamp}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
