"use client";

import React from "react";
import {
  Home,
  Bot,
  GitFork,
  BookOpen,
  PhoneCall,
  PhoneIncoming,
  Megaphone,
  CodeXml,
  BarChart3,
  Kanban,
  Settings,
  Sparkles,
  PieChart,
  CreditCard,
  FileText,
  ChevronDown,
  PanelLeftClose,
  HeartPulse,
  ShieldAlert,
  User,
} from "lucide-react";

export type PlatformTab =
  | "home"
  | "analytics"
  | "call_logs"
  | "goals"
  | "needs_attention"
  | "parents"
  | "settings";

interface PlatformSidebarProps {
  activeTab: PlatformTab;
  onTabChange: (tab: PlatformTab) => void;
  attentionCount?: number;
  userName?: string;
  userEmail?: string;
}

export function PlatformSidebar({
  activeTab,
  onTabChange,
  attentionCount = 0,
  userName = "Ved Pratap Singh",
  userEmail = "vedna400@gmail.com",
}: PlatformSidebarProps) {
  return (
    <aside className="w-60 bg-white border-r border-[#EAEAEA] flex flex-col justify-between select-none h-screen sticky top-0 shrink-0 text-[#1D1D1F] text-[13px] font-normal">
      {/* Top Section */}
      <div className="overflow-y-auto py-3">
        {/* Brand Header */}
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] tracking-tight text-[#111111]">
              Voice Agents
            </span>
          </div>
          <button
            title="Collapse sidebar"
            className="text-[#888888] hover:text-[#111111] p-1 rounded-md hover:bg-[#F4F4F5] transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="mt-3 px-2 space-y-4">
          {/* Home */}
          <div>
            <button
              onClick={() => onTabChange("home")}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                activeTab === "home"
                  ? "bg-[#F3F4F6] text-[#111111] font-medium"
                  : "text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111]"
              }`}
            >
              <Home className="w-4 h-4 text-[#666666]" />
              <span>Home</span>
            </button>
          </div>

          {/* Group: Build */}
          <div className="space-y-0.5">
            <div className="px-3 py-1 text-[11px] font-medium text-[#888888] uppercase tracking-wider">
              Build
            </div>
            <button
              onClick={() => onTabChange("analytics")}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors"
            >
              <Bot className="w-4 h-4 text-[#666666]" />
              <span>Agents</span>
            </button>
            <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
              <GitFork className="w-4 h-4 text-[#666666]" />
              <span>Workflows</span>
            </button>
            <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
              <BookOpen className="w-4 h-4 text-[#666666]" />
              <span>Knowledge base</span>
            </button>
          </div>

          {/* Group: Deploy */}
          <div className="space-y-0.5">
            <div className="px-3 py-1 text-[11px] font-medium text-[#888888] uppercase tracking-wider">
              Deploy
            </div>
            <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
              <PhoneCall className="w-4 h-4 text-[#666666]" />
              <span>Phone numbers</span>
            </button>
            <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
              <PhoneIncoming className="w-4 h-4 text-[#666666]" />
              <span>Inbound calls</span>
            </button>
            <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
              <Megaphone className="w-4 h-4 text-[#666666]" />
              <span>Outbound campaigns</span>
            </button>
            <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
              <CodeXml className="w-4 h-4 text-[#666666]" />
              <span>Deploy with code</span>
            </button>
          </div>

          {/* Group: Monitor (Matching screenshot active item) */}
          <div className="space-y-0.5">
            <div className="px-3 py-1 text-[11px] font-medium text-[#888888] uppercase tracking-wider">
              Monitor
            </div>
            <button
              onClick={() => onTabChange("analytics")}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                activeTab === "analytics"
                  ? "bg-[#F3F4F6] text-[#111111] font-medium"
                  : "text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111]"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-[#666666]" />
              <span>Agent analytics</span>
            </button>
            <button
              onClick={() => onTabChange("call_logs")}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                activeTab === "call_logs"
                  ? "bg-[#F3F4F6] text-[#111111] font-medium"
                  : "text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111]"
              }`}
            >
              <FileText className="w-4 h-4 text-[#666666]" />
              <span>Call logs</span>
            </button>
            <button className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
              <div className="flex items-center gap-2.5">
                <Kanban className="w-4 h-4 text-[#666666]" />
                <span>Boards</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#999999]" />
            </button>
          </div>

          {/* Group: Care & Living Health (Our Core Healthcare Need) */}
          <div className="space-y-0.5 pt-1 border-t border-[#F0F0F0]">
            <div className="px-3 py-1 text-[11px] font-medium text-[#0071E3] uppercase tracking-wider flex items-center justify-between">
              <span>Anyash Care</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <button
              onClick={() => onTabChange("needs_attention")}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                activeTab === "needs_attention"
                  ? "bg-rose-50 text-rose-900 font-medium border border-rose-200"
                  : "text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Needs Attention</span>
              </div>
              {attentionCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {attentionCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onTabChange("parents")}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                activeTab === "parents"
                  ? "bg-[#F3F4F6] text-[#111111] font-medium"
                  : "text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111]"
              }`}
            >
              <HeartPulse className="w-4 h-4 text-[#0071E3]" />
              <span>Parents Directory</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Bottom Footer Section */}
      <div className="p-3 border-t border-[#EAEAEA] space-y-1">
        <button
          onClick={() => onTabChange("settings")}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
            activeTab === "settings"
              ? "bg-[#F3F4F6] text-[#111111] font-medium"
              : "text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111]"
          }`}
        >
          <Settings className="w-4 h-4 text-[#666666]" />
          <span>Settings</span>
        </button>

        <button className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#666666]" />
            <span>MCP</span>
          </div>
          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
            New
          </span>
        </button>

        <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
          <PieChart className="w-4 h-4 text-[#666666]" />
          <span>Usage</span>
        </button>

        <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
          <CreditCard className="w-4 h-4 text-[#666666]" />
          <span>Pricing</span>
        </button>

        <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] text-[#555555] hover:bg-[#F9FAFB] hover:text-[#111111] transition-colors">
          <FileText className="w-4 h-4 text-[#666666]" />
          <span>Documentation</span>
        </button>

        {/* User Card */}
        <div className="pt-2 mt-2 border-t border-[#F0F0F0] flex items-center gap-2.5 px-2 py-1">
          <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
            {userName.charAt(0)}
          </div>
          <div className="truncate text-left leading-tight">
            <div className="text-[12px] font-medium text-[#111111] truncate">
              {userName}
            </div>
            <div className="text-[10px] text-[#888888] truncate">
              {userEmail}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
