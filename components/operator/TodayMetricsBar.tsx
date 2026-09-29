"use client";

import React from "react";
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarCheck,
} from "lucide-react";

interface TodayMetricsBarProps {
  parentsEnrolledCount: number;
  callsCompletedCount: number;
  callsPendingCount: number;
  issuesDetectedCount: number;
  followUpsDueCount: number;
  onFilterChange?: (filterType: string) => void;
}

export function TodayMetricsBar({
  parentsEnrolledCount,
  callsCompletedCount,
  callsPendingCount,
  issuesDetectedCount,
  followUpsDueCount,
  onFilterChange,
}: TodayMetricsBarProps) {
  const metrics = [
    {
      id: "enrolled",
      label: "Parents enrolled",
      value: parentsEnrolledCount,
      subtext: "3 Active · 1 Pending",
      icon: <Users className="w-4 h-4 text-[#0071E3]" />,
      iconBg: "bg-blue-50 border-blue-100",
      accent: "text-[#0071E3]",
    },
    {
      id: "completed",
      label: "Calls completed",
      value: callsCompletedCount,
      subtext: "Today's morning batch",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      iconBg: "bg-emerald-50 border-emerald-100",
      accent: "text-emerald-600",
    },
    {
      id: "pending",
      label: "Calls pending",
      value: callsPendingCount,
      subtext: "Scheduled for today",
      icon: <Clock className="w-4 h-4 text-amber-600" />,
      iconBg: "bg-amber-50 border-amber-100",
      accent: "text-amber-600",
    },
    {
      id: "issues",
      label: "Issues detected",
      value: issuesDetectedCount,
      subtext: "Knee pain, Dizziness",
      icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
      iconBg: "bg-rose-50 border-rose-100",
      accent: "text-rose-600",
    },
    {
      id: "followups",
      label: "Follow-ups due",
      value: followUpsDueCount,
      subtext: "Active automated memory",
      icon: <CalendarCheck className="w-4 h-4 text-indigo-600" />,
      iconBg: "bg-indigo-50 border-indigo-100",
      accent: "text-indigo-600",
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-[#86868B] uppercase">
          Today Overview
        </h2>
        <span className="text-[11px] text-[#86868B]">
          Live surveillance · Auto-refreshed
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {metrics.map((m) => (
          <div
            key={m.id}
            onClick={() => onFilterChange && onFilterChange(m.id)}
            className="bg-white rounded-xl p-3.5 border border-[#E5E7EB] hover:border-[#D1D5DB] transition-all cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-[#6E6E73] group-hover:text-[#1D1D1F] transition-colors">
                {m.label}
              </span>
              <div
                className={`w-7 h-7 rounded-lg border flex items-center justify-center ${m.iconBg}`}
              >
                {m.icon}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
                {m.value}
              </span>
            </div>
            <p className="text-[11px] text-[#86868B] mt-1 truncate">
              {m.subtext}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
