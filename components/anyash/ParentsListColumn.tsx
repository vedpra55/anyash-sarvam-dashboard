"use client";

import React from "react";
import { ChevronRight, Plus, User } from "lucide-react";

export interface ParentItem {
  id: string;
  parent_name: string;
  phone_number: string;
  child_name?: string;
  honorific?: string;
  facts?: any;
  routines?: any[];
  medical_baseline?: any;
  current_user_context?: string;
  latestCall?: any;
  latestLog?: any;
  calls?: any[];
  dailyLogs?: any[];
  updated_at?: string;
  avatar_url?: string;
  number_of_calls?: number;
}

interface ParentsListColumnProps {
  parents: ParentItem[];
  selectedParentId: string | null;
  onSelectParent: (parent: ParentItem) => void;
  onAddParentClick: () => void;
}

// Format relative date nicely
function formatLastCallTime(dateStr?: string): string {
  if (!dateStr) return "Never called";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Recently";

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (diffDays === 0) {
    return `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday, ${timeStr}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ParentsListColumn({
  parents,
  selectedParentId,
  onSelectParent,
  onAddParentClick,
}: ParentsListColumnProps) {
  return (
    <div className="w-[360px] shrink-0 border-r border-[#1C1F24] flex flex-col h-full bg-[#0C0D0E] select-none">
      {/* Column Header */}
      <div className="p-6 pb-5 border-b border-[#1C1F24]/60">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-2xl font-bold text-white tracking-tight">Parents</h2>
          <button
            onClick={onAddParentClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FEE5A5] text-[#18181B] text-xs font-semibold hover:bg-[#FDE047] active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Parent</span>
          </button>
        </div>
        <p className="text-xs text-[#8E929A]">People you care about, in one place.</p>
      </div>

      {/* Parents Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {parents.length === 0 ? (
          <div className="p-8 text-center text-[#717680] text-xs space-y-3">
            <p>No parents added yet.</p>
            <button
              onClick={onAddParentClick}
              className="text-xs text-[#FEE5A5] hover:underline"
            >
              Add your first parent
            </button>
          </div>
        ) : (
          parents.map((parent) => {
            const isSelected = parent.id === selectedParentId;
            const relationship = parent.facts?.relationship || "Mother";
            const lastCallTimestamp =
              parent.latestCall?.created_at || parent.latestLog?.created_at || parent.updated_at;
            const lastCallText = formatLastCallTime(lastCallTimestamp);

            return (
              <div
                key={parent.id}
                onClick={() => onSelectParent(parent)}
                className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border ${
                  isSelected
                    ? "bg-[#16181B] border-[#2A2E35] shadow-sm"
                    : "bg-transparent border-transparent hover:bg-[#131518] hover:border-[#1E2126]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Status Indicator Dot */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ml-1 ${
                      isSelected
                        ? "bg-[#FEE5A5] ring-4 ring-[#FEE5A5]/20"
                        : "bg-emerald-500/80 group-hover:bg-emerald-400"
                    }`}
                  />

                  {/* Name and Meta */}
                  <div className="min-w-0">
                    <h3
                      className={`text-sm font-semibold truncate leading-tight ${
                        isSelected ? "text-white" : "text-[#D1D5DB] group-hover:text-white"
                      }`}
                    >
                      {parent.parent_name}
                    </h3>
                    <div className="text-xs text-[#717680] truncate leading-tight mt-1 flex items-center gap-1.5">
                      <span>{relationship}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-zinc-500">{parent.phone_number}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <p className="text-[11px] text-[#555B66] truncate leading-tight">
                        Last call: {lastCallText}
                      </p>
                      {parent.facts?.language && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#1C1F26] border border-[#2B2F38] text-[#9EA3AE] rounded font-medium leading-none">
                          {parent.facts.language}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chevron */}
                <ChevronRight
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isSelected ? "text-white" : "text-[#4B515D] group-hover:text-[#8E929A]"
                  }`}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
