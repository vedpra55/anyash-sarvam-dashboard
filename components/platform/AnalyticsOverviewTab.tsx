"use client";

import React, { useState } from "react";
import { ChevronDown, ArrowUpRight, CheckCircle2, PhoneOff } from "lucide-react";
import { PlatformAnalyticsOverview } from "@/lib/types";

interface AnalyticsOverviewTabProps {
  analytics: PlatformAnalyticsOverview;
  isPercentMode?: boolean;
}

type SelectedMetricKey =
  | "attempted"
  | "connected"
  | "latency"
  | "avg_duration"
  | "total_minutes"
  | "short_calls";

export function AnalyticsOverviewTab({
  analytics,
  isPercentMode,
}: AnalyticsOverviewTabProps) {
  const [selectedMetric, setSelectedMetric] = useState<SelectedMetricKey>("attempted");

  const metricTiles: {
    key: SelectedMetricKey;
    label: string;
    value: string | number;
    sublabel?: string;
  }[] = [
    {
      key: "attempted",
      label: "Calls attempted",
      value: analytics.callsAttempted,
    },
    {
      key: "connected",
      label: "Connected calls",
      value: isPercentMode
        ? `${analytics.connectivityRate.toFixed(1)}%`
        : analytics.connectedCalls,
    },
    {
      key: "latency",
      label: "Latency",
      value: `${analytics.latencyMs} ms`,
    },
    {
      key: "avg_duration",
      label: "Avg call duration",
      value: analytics.avgCallDurationFormatted,
    },
    {
      key: "total_minutes",
      label: "Total minutes",
      value: analytics.totalMinutes,
    },
    {
      key: "short_calls",
      label: "Short calls",
      value: analytics.shortCalls,
    },
  ];

  // Calculate dynamic point for SVG chart
  const getYValue = () => {
    switch (selectedMetric) {
      case "attempted":
        return analytics.callsAttempted; // 14
      case "connected":
        return analytics.connectedCalls; // 11
      case "short_calls":
        return analytics.shortCalls; // 1
      default:
        return analytics.callsAttempted;
    }
  };

  const chartVal = getYValue();
  const maxVal = 16;
  const pointY = 220 - (chartVal / maxVal) * 180; // mapped to SVG height

  return (
    <div className="space-y-6">
      {/* 1. Main Interactive Analytics Card (Image 1) */}
      <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-6 space-y-6">
        {/* Metrics Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F0F0] pb-5">
          <div className="flex flex-wrap items-center gap-2">
            {metricTiles.map((tile) => {
              const isSelected = selectedMetric === tile.key;
              return (
                <button
                  key={tile.key}
                  onClick={() => setSelectedMetric(tile.key)}
                  className={`p-3.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? "bg-[#F3F4F6] text-[#111111] shadow-sm ring-1 ring-[#E5E7EB]"
                      : "hover:bg-[#F9FAFB] text-[#444444]"
                  }`}
                >
                  <div className="text-[12px] font-normal text-[#666666]">
                    {tile.label}
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-[#111111] mt-1">
                    {tile.value}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Timeframe dropdown on right */}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E5E5E5] text-xs font-medium text-[#333333] hover:bg-[#F9FAFB] cursor-pointer">
            <span>Day</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#777777]" />
          </div>
        </div>

        {/* SVG Time-Series Chart */}
        <div className="w-full pt-4">
          <div className="h-64 w-full relative">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 800 240"
              preserveAspectRatio="none"
            >
              {/* Horizontal dashed gridlines at 16, 12, 8, 4, 0 */}
              <line
                x1="40"
                y1="40"
                x2="800"
                y2="40"
                stroke="#EAEAEA"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text x="10" y="44" fill="#999999" fontSize="11" fontFamily="sans-serif">
                16
              </text>

              <line
                x1="40"
                y1="85"
                x2="800"
                y2="85"
                stroke="#EAEAEA"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text x="10" y="89" fill="#999999" fontSize="11" fontFamily="sans-serif">
                12
              </text>

              <line
                x1="40"
                y1="130"
                x2="800"
                y2="130"
                stroke="#EAEAEA"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text x="10" y="134" fill="#999999" fontSize="11" fontFamily="sans-serif">
                8
              </text>

              <line
                x1="40"
                y1="175"
                x2="800"
                y2="175"
                stroke="#EAEAEA"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text x="10" y="179" fill="#999999" fontSize="11" fontFamily="sans-serif">
                4
              </text>

              <line
                x1="40"
                y1="220"
                x2="800"
                y2="220"
                stroke="#CCCCCC"
                strokeWidth="1"
              />
              <text x="10" y="224" fill="#999999" fontSize="11" fontFamily="sans-serif">
                0
              </text>

              {/* Data curve & point */}
              <circle
                cx="480"
                cy={pointY}
                r="4.5"
                fill="#2563EB"
                className="transition-all duration-300"
              />
            </svg>

            {/* X-axis date label */}
            <div className="absolute bottom-[-8px] left-[58%] -translate-x-1/2 text-[11px] text-[#888888] font-normal">
              {new Date().toLocaleDateString([], { month: "short", day: "numeric" })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bottom Split Cards: Call outcomes & Top failure reasons (Image 1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Call outcomes */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#111111]">
              Call outcomes
            </h3>
            <p className="text-[12px] text-[#666666]">
              {analytics.callOutcomesCount} attempts
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-[#333333] font-medium">Connected Calls</span>
              </div>
              <span className="font-semibold text-[#111111]">
                {analytics.connectedCalls} ({analytics.connectivityRate.toFixed(0)}%)
              </span>
            </div>

            <div className="w-full bg-[#F3F4F6] rounded-full h-2 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${analytics.connectivityRate}%` }}
              ></div>
              <div
                className="bg-rose-400 h-full"
                style={{ width: `${100 - analytics.connectivityRate}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-[#666666]">
              <div className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#F0F0F0]">
                <div>Meaningful Check-ins</div>
                <div className="text-base font-semibold text-[#111111] mt-0.5">
                  {analytics.connectedCalls} calls
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#F0F0F0]">
                <div>Partial / Unanswered</div>
                <div className="text-base font-semibold text-[#111111] mt-0.5">
                  {Math.max(0, analytics.callsAttempted - analytics.connectedCalls)} calls
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top failure reasons */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#111111]">
              Top failure reasons
            </h3>
            <p className="text-[12px] text-[#666666]">
              {analytics.topFailureReasonsCount} total failures
            </p>
          </div>

          <div className="py-8 text-center text-xs text-[#888888]">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-80" />
            <span>0 telephony connection failures reported in this timeframe</span>
          </div>
        </div>
      </div>
    </div>
  );
}
