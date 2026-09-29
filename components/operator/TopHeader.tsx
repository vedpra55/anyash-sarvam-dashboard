"use client";

import React from "react";
import { Search, RefreshCw, Plus, UserCheck, PhoneCall } from "lucide-react";
import { NavTab } from "./Sidebar";

interface TopHeaderProps {
  activeTab: NavTab;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isSyncing: boolean;
  onSync: () => void;
  onAddParentClick: () => void;
  onStartQuickCall?: () => void;
}

export function TopHeader({
  activeTab,
  searchQuery,
  onSearchChange,
  isSyncing,
  onSync,
  onAddParentClick,
  onStartQuickCall,
}: TopHeaderProps) {
  const getTabTitle = () => {
    switch (activeTab) {
      case "dashboard":
        return {
          title: "Operator Dashboard",
          subtitle: "Live surveillance of scheduled parent calls, alerts & triage",
        };
      case "parents":
        return {
          title: "Enrolled Parents",
          subtitle: "Parent profiles, longitudinal health memory, and care circles",
        };
      case "attention":
        return {
          title: "Needs Attention",
          subtitle: "Decisions requiring operator monitoring, family dispatch, or review",
        };
      case "calls":
        return {
          title: "Call Logs & Transcripts",
          subtitle: "Historical conversations, recordings, and Anyash clinical summaries",
        };
      case "settings":
        return {
          title: "System & Telephony Settings",
          subtitle: "Sarvam AI API credentials, webhooks, and agent personas",
        };
      default:
        return {
          title: "Operator Dashboard",
          subtitle: "Live surveillance of parent calls and decisions",
        };
    }
  };

  const { title, subtitle } = getTabTitle();

  return (
    <header className="h-16 px-8 bg-white/80 backdrop-blur-md border-b border-[#E5E7EB] flex items-center justify-between sticky top-0 z-20">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
          {title}
        </h1>
        <p className="text-[12px] text-[#6E6E73] hidden sm:block">
          {subtitle}
        </p>
      </div>

      {/* Right Actions: Search + Sync + Add Parent + User */}
      <div className="flex items-center gap-3">
        {/* Apple-style search field */}
        <div className="relative w-56 sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" />
          <input
            type="text"
            placeholder="Search parent, symptom..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#F5F5F7] hover:bg-[#EBECEF] focus:bg-white text-[13px] text-[#1D1D1F] placeholder-[#86868B] pl-9 pr-3 py-1.5 rounded-lg border border-transparent focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all outline-none"
          />
        </div>

        {/* Sarvam Sync Button */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          title="Sync live telephony calls with Sarvam AI"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#424245] bg-[#F5F5F7] hover:bg-[#EBECEF] active:bg-[#E2E4E8] rounded-lg border border-[#E5E7EB] transition-all"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#6E6E73] ${
              isSyncing ? "animate-spin text-[#0071E3]" : ""
            }`}
          />
          <span className="hidden md:inline">
            {isSyncing ? "Syncing..." : "Sync Sarvam"}
          </span>
        </button>

        {/* Add Parent CTA in Apple System Blue */}
        <button
          onClick={onAddParentClick}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0066CC] text-white text-xs font-medium rounded-lg shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Parent</span>
        </button>

        {/* Operator Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#E5E7EB]">
          <div className="w-7 h-7 rounded-full bg-[#EFF0F2] border border-[#E5E7EB] flex items-center justify-center text-[#424245]">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-[12px] font-medium leading-none text-[#1D1D1F]">
              Operator
            </div>
            <div className="text-[10px] text-emerald-600 font-medium leading-none mt-0.5">
              Online
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
