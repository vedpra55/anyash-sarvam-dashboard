"use client";

import React, { useState } from "react";
import { Search, Bot, Clock, ArrowRight, Sparkles, Plus, PhoneCall } from "lucide-react";
import { PlatformAnalyticsOverview, CallRecord } from "@/lib/types";

interface HomeOverviewTabProps {
  analytics: PlatformAnalyticsOverview;
  calls?: CallRecord[];
  userName?: string;
  userEmail?: string;
  onSelectAgent?: () => void;
  onNewCall?: () => void;
}

export function HomeOverviewTab({
  analytics,
  calls = [],
  userName = "Ved Pratap Singh",
  userEmail = "vedna400@gmail.com",
  onSelectAgent,
  onNewCall,
}: HomeOverviewTabProps) {
  const [selectedTemplate, setSelectedTemplate] = useState("All");
  const [searchAgent, setSearchAgent] = useState("");

  const templates = [
    "All",
    "Elderly Care",
    "Daily Check-in",
    "Medication Reminder",
    "Symptom Follow-up",
    "Emergency Triage",
  ];

  // Derive dynamic hour bars from live analytics hourlyData
  const displayHours =
    analytics.hourlyData && analytics.hourlyData.length > 0
      ? analytics.hourlyData
          .filter((_, i) => i % 2 === 0 || i === 23)
          .map((h) => ({
            label: h.hourLabel,
            rate: h.connectivityRate,
          }))
      : [
          { label: "12AM", rate: 0 },
          { label: "2AM", rate: 0 },
          { label: "4AM", rate: 0 },
          { label: "6AM", rate: 0 },
          { label: "8AM", rate: 0 },
          { label: "10AM", rate: 0 },
          { label: "12PM", rate: 0 },
          { label: "2PM", rate: 0 },
          { label: "4PM", rate: 0 },
          { label: "6PM", rate: 0 },
          { label: "8PM", rate: 0 },
          { label: "10PM", rate: 0 },
        ];

  // Filter recent calls dynamically
  const filteredCalls = (calls || []).filter((c) => {
    if (!searchAgent) return true;
    const term = searchAgent.toLowerCase();
    return (
      (c.parentName && c.parentName.toLowerCase().includes(term)) ||
      (c.userIdentifier && c.userIdentifier.toLowerCase().includes(term)) ||
      (c.summary && c.summary.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-8 max-w-5xl">
      {/* 1. Warm Greeting in Modern Display Typography */}
      <div>
        <h1 className="text-3xl font-serif tracking-tight text-[#111111] font-normal">
          Good afternoon, {userName}
        </h1>
        <p className="text-xs text-[#777777] mt-1 font-sans">
          Welcome to the Anyash Autonomous Voice Health Control Room
        </p>
      </div>

      {/* 2. Total Live Calls Card with Hourly Connectivity Chart (Image 3) */}
      <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div>
          <div className="text-[12px] font-normal text-[#666666]">
            Total Live calls
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#111111] mt-1">
            {analytics.callsAttempted}
          </div>
        </div>

        {/* 24-Hour Bar Chart */}
        <div className="pt-2">
          <div className="h-44 w-full relative flex flex-col justify-end">
            {/* Horizontal guidelines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-[#999999] font-mono">
              <div className="border-b border-dashed border-[#F0F0F0] pb-0.5 flex justify-between">
                <span>100</span>
                <span className="text-[9px] uppercase tracking-wider text-[#AAAAAA] pr-2">
                  Connectivity Rate (%)
                </span>
              </div>
              <div className="border-b border-dashed border-[#F0F0F0] pb-0.5">
                <span>60</span>
              </div>
              <div className="border-b border-dashed border-[#F0F0F0] pb-0.5">
                <span>30</span>
              </div>
              <div className="border-b border-[#CCCCCC] pb-0.5">
                <span>0</span>
              </div>
            </div>

            {/* Bars container */}
            <div className="relative z-10 grid grid-cols-13 gap-1 h-32 items-end px-6">
              {displayHours.map((h, i) => (
                <div key={i} className="flex flex-col items-center h-full justify-end group">
                  {h.rate > 0 ? (
                    <div
                      className="w-3.5 rounded-t-sm transition-all duration-300 hover:opacity-80"
                      style={{
                        height: `${Math.max((h.rate / 100) * 100, 4)}%`,
                        backgroundColor: "#3B82F6",
                      }}
                      title={`${h.label}: ${h.rate}% connectivity`}
                    />
                  ) : (
                    <div className="w-3.5 h-[1px] bg-transparent" />
                  )}
                </div>
              ))}
            </div>

            {/* X-axis labels */}
            <div className="grid grid-cols-13 gap-1 text-[10px] text-[#888888] font-mono text-center pt-2 px-6">
              {displayHours.map((h, i) => (
                <span key={i} className="truncate">
                  {h.label}
                </span>
              ))}
            </div>

            <div className="text-center text-[10px] text-[#999999] uppercase tracking-wider mt-1">
              Hour of Day
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recents Section (Image 3) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[#111111]">
            Recents
          </h2>
          {onNewCall && (
            <button
              onClick={onNewCall}
              className="inline-flex items-center gap-1.5 text-xs text-[#0071E3] font-medium hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Call</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
          <input
            type="text"
            placeholder="Search recent calls..."
            value={searchAgent}
            onChange={(e) => setSearchAgent(e.target.value)}
            className="w-full bg-white text-xs text-[#111111] placeholder-[#888888] pl-9 pr-3 py-2 rounded-xl border border-[#E5E5E5] focus:border-[#0071E3] outline-none"
          />
        </div>

        {/* Recents Table */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="grid grid-cols-12 px-6 py-2.5 text-[11px] text-[#888888] font-normal border-b border-[#F0F0F0]">
            <div className="col-span-8">Call Session / Caller</div>
            <div className="col-span-4 text-right">Timestamp</div>
          </div>

          {filteredCalls.length > 0 ? (
            filteredCalls.slice(0, 5).map((call) => (
              <div
                key={call.attemptId}
                onClick={onSelectAgent}
                className="grid grid-cols-12 px-6 py-4 items-center hover:bg-[#F9FAFB] cursor-pointer transition-colors border-b border-[#F5F5F5] last:border-b-0"
              >
                <div className="col-span-8 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-[#0071E3] flex items-center justify-center font-bold text-xs">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-[#111111]">
                      {call.parentName || call.userIdentifier || "Voice Session"}
                    </div>
                    <div className="text-[11px] text-[#777777] truncate max-w-md">
                      {call.summary || `${call.durationSeconds}s · ${call.status}`}
                    </div>
                  </div>
                </div>

                <div className="col-span-4 text-right text-xs text-[#777777]">
                  {call.timestamp}
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-xs text-[#888888]">
              No call sessions recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* 4. Agent Templates Section (Image 3) */}
      <div className="space-y-3">
        <h2 className="text-[16px] font-semibold text-[#111111]">
          Agent templates
        </h2>

        <div className="flex flex-wrap items-center gap-1.5">
          {templates.map((tpl) => (
            <button
              key={tpl}
              onClick={() => setSelectedTemplate(tpl)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedTemplate === tpl
                  ? "bg-[#1F2937] text-white shadow-sm"
                  : "bg-white hover:bg-[#F4F4F5] text-[#444444] border border-[#E5E5E5]"
              }`}
            >
              {tpl}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
