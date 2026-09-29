"use client";

import React from "react";
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  PhoneCall,
  Settings,
  HeartPulse,
  Radio,
  Plus,
} from "lucide-react";

export type NavTab = "dashboard" | "parents" | "attention" | "calls" | "settings";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onAddParentClick: () => void;
  attentionCount?: number;
}

export function Sidebar({
  activeTab,
  onTabChange,
  onAddParentClick,
  attentionCount = 3,
}: SidebarProps) {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-[18px] h-[18px]" strokeWidth={1.8} />,
    },
    {
      id: "parents",
      label: "Parents",
      icon: <Users className="w-[18px] h-[18px]" strokeWidth={1.8} />,
    },
    {
      id: "attention",
      label: "Needs Attention",
      icon: <ShieldAlert className="w-[18px] h-[18px]" strokeWidth={1.8} />,
      badge: attentionCount,
    },
    {
      id: "calls",
      label: "Calls",
      icon: <PhoneCall className="w-[18px] h-[18px]" strokeWidth={1.8} />,
    },
  ];

  return (
    <aside className="w-64 bg-[#FBFBFC] border-r border-[#E5E7EB] flex flex-col justify-between select-none h-screen sticky top-0 shrink-0">
      {/* Top Branding */}
      <div>
        <div className="p-5 pb-4 border-b border-[#F0F0F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3] flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[15px] tracking-tight text-[#1D1D1F]">
                  Anyash
                </span>
                <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-[#0071E3] border border-blue-200/50">
                  Control Room
                </span>
              </div>
              <p className="text-[11px] text-[#6E6E73] font-normal leading-tight mt-0.5">
                Operator Dashboard
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={onAddParentClick}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-lg text-xs font-medium shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Parent</span>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="p-3 space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
            Overview
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-[#0071E3] text-white shadow-sm"
                    : "text-[#424245] hover:bg-[#F2F2F5] hover:text-[#1D1D1F]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? "text-white" : "text-[#6E6E73]"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[11px] font-semibold px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? "bg-white text-[#0071E3]"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-3 border-t border-[#F0F0F2] space-y-2">
        <button
          onClick={() => onTabChange("settings")}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
            activeTab === "settings"
              ? "bg-[#0071E3] text-white"
              : "text-[#424245] hover:bg-[#F2F2F5] hover:text-[#1D1D1F]"
          }`}
        >
          <Settings className="w-[18px] h-[18px] text-[#6E6E73]" strokeWidth={1.8} />
          <span>Settings</span>
        </button>

        {/* Telephony Connection Health Pill */}
        <div className="px-3 py-2 rounded-lg bg-[#F5F5F7] border border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-medium text-[#1D1D1F]">
              Sarvam AI Live
            </span>
          </div>
          <span className="text-[10px] text-[#86868B] uppercase tracking-wide">
            Auto-Sync
          </span>
        </div>
      </div>
    </aside>
  );
}
