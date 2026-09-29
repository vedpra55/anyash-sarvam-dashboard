"use client";

import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Calendar,
  X,
  Plus,
  SlidersHorizontal,
} from "lucide-react";

export type AnalyticsSubTab =
  | "overview"
  | "connectivity"
  | "engagement"
  | "tools"
  | "goals"
  | "group_by"
  | "call_logs"
  | "needs_attention"
  | "parents";

interface PlatformBreadcrumbsProps {
  currentTab: AnalyticsSubTab;
  onTabChange: (tab: AnalyticsSubTab) => void;
  dateRangeText?: string;
  isPercentMode?: boolean;
  onTogglePercentMode?: () => void;
  attentionBadgeCount?: number;
}

export function PlatformBreadcrumbs({
  currentTab,
  onTabChange,
  dateRangeText,
  isPercentMode = false,
  onTogglePercentMode,
  attentionBadgeCount = 0,
}: PlatformBreadcrumbsProps) {
  const displayDateRange =
    dateRangeText ||
    new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const tabs: { id: AnalyticsSubTab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "connectivity", label: "Connectivity" },
    { id: "engagement", label: "Engagement" },
    { id: "tools", label: "Tools" },
    { id: "goals", label: "Goals" },
    { id: "group_by", label: "Group by" },
    { id: "call_logs", label: "Call Logs" },
    { id: "needs_attention", label: "Needs Attention", badge: attentionBadgeCount },
    { id: "parents", label: "Parents Directory" },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Breadcrumb row */}
      <div className="flex items-center gap-1.5 text-[13px] text-[#666666]">
        <span className="hover:text-[#111111] cursor-pointer">Agent Analytics</span>
        <span className="text-[#BBBBBB]">/</span>
        <div className="flex items-center gap-1 hover:text-[#111111] cursor-pointer">
          <span>v2v</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#888888]" />
        </div>
        <span className="text-[#BBBBBB]">/</span>
        <div className="flex items-center gap-1 font-medium text-[#111111] cursor-pointer">
          <span>All Agents</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#888888]" />
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Campaign Filter Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F4F4F5] hover:bg-[#EAEAEA] border border-[#E5E5E5] text-xs text-[#222222] transition-colors cursor-pointer">
            <span>All Campaigns</span>
            <button className="text-[#888888] hover:text-[#111111]">
              <X className="w-3 h-3" />
            </button>
            <ChevronDown className="w-3 h-3 text-[#888888]" />
          </div>

          {/* Date Range Filter Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white hover:bg-[#F9FAFB] border border-[#E5E5E5] text-xs text-[#222222] transition-colors cursor-pointer">
            <Calendar className="w-3.5 h-3.5 text-[#666666]" />
            <span>{displayDateRange}</span>
          </div>

          {/* Add Filter CTA */}
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#F9FAFB] border border-[#E5E5E5] text-xs font-medium text-[#222222] transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#666666]" />
            <span>Add filter</span>
          </button>
        </div>

        {/* # / % Toggle on Right */}
        {onTogglePercentMode && (
          <div className="inline-flex items-center bg-[#F4F4F5] p-0.5 rounded-lg border border-[#E5E5E5] text-xs">
            <button
              onClick={onTogglePercentMode}
              className={`px-2.5 py-1 rounded-md transition-all font-mono font-medium ${
                !isPercentMode
                  ? "bg-white text-[#111111] shadow-sm"
                  : "text-[#777777] hover:text-[#111111]"
              }`}
            >
              #
            </button>
            <button
              onClick={onTogglePercentMode}
              className={`px-2.5 py-1 rounded-md transition-all font-mono font-medium ${
                isPercentMode
                  ? "bg-white text-[#111111] shadow-sm"
                  : "text-[#777777] hover:text-[#111111]"
              }`}
            >
              %
            </button>
          </div>
        )}
      </div>

      {/* 3. Underline Sub-Navigation Tabs */}
      <div className="border-b border-[#EAEAEA] flex items-center gap-6 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`pb-2.5 text-[13px] font-medium transition-all relative shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? "text-[#111111]"
                  : "text-[#666666] hover:text-[#111111]"
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#111111]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
