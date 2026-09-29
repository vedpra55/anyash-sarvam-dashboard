"use client";

import React, { useState } from "react";
import {
  Phone,
  Plus,
  Search,
  HeartPulse,
  Activity,
  Pill,
  User,
  AlertCircle,
  Pencil,
  Trash2,
  Filter,
} from "lucide-react";
import { ParentProfile, ParentOperationalStatus } from "@/lib/types";

interface ParentsDirectoryTabProps {
  parents: ParentProfile[];
  onCallParent: (parent: ParentProfile) => void;
  onAddParent: () => void;
  onEditParent: (parent: ParentProfile) => void;
  onDeleteParent: (parent: ParentProfile) => void;
  onSelectParent: (parent: ParentProfile) => void;
}

export function ParentsDirectoryTab({
  parents,
  onCallParent,
  onAddParent,
  onEditParent,
  onDeleteParent,
  onSelectParent,
}: ParentsDirectoryTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ParentOperationalStatus>("all");

  const filtered = parents.filter((p) => {
    const matchesSearch =
      p.parentName.toLowerCase().includes(search.toLowerCase()) ||
      p.parentPhone.includes(search) ||
      p.preferredLanguage.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || (p.status || "Active") === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#EAEAEA] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[#111111]">
            Enrolled Parents Directory
          </h2>
          <p className="text-xs text-[#666666] mt-0.5">
            Active care circles, living health signals, and automated check-in schedules ({parents.length} enrolled)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter pills */}
          <div className="inline-flex items-center p-1 bg-[#F4F4F5] rounded-xl border border-[#E5E5E5] text-xs">
            {(["all", "Active", "Pending"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === s
                    ? "bg-white text-[#111111] shadow-sm"
                    : "text-[#666666] hover:text-[#111111]"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
            <input
              type="text"
              placeholder="Search parent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#F4F4F5] text-xs text-[#111111] placeholder-[#888888] pl-9 pr-3 py-1.5 rounded-xl border border-transparent focus:border-[#0071E3] outline-none"
            />
          </div>

          <button
            onClick={onAddParent}
            className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Parent</span>
          </button>
        </div>
      </div>

      {/* Parents Grid or Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-12 text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0071E3] mx-auto flex items-center justify-center border border-blue-100">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#111111]">
              No Enrolled Parents Yet
            </div>
            <p className="text-xs text-[#777777] max-w-sm mx-auto mt-1">
              Add your family members or care recipients to begin autonomous health surveillance and conversational check-ins.
            </p>
          </div>
          <button
            onClick={onAddParent}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Parent</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((parent) => (
          <div
            key={parent.id}
            onClick={() => onSelectParent(parent)}
            title={`Click to view detailed medical profile & call history for ${parent.parentName}`}
            className="bg-white rounded-2xl border border-[#EAEAEA] hover:border-[#0071E3]/40 hover:shadow-md p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all cursor-pointer space-y-4 group relative"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0071E3] font-bold text-sm flex items-center justify-center border border-blue-100 group-hover:bg-[#0071E3] group-hover:text-white transition-colors">
                  {parent.parentName.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[#111111] group-hover:text-[#0071E3] transition-colors flex items-center gap-1.5">
                    <span>{parent.parentName}</span>
                  </h3>
                  <div className="text-[11px] text-[#777777]">
                    {parent.preferredLanguage} · {parent.age || 60} yrs
                  </div>
                </div>
              </div>

              {/* Status pill & CRUD action icons */}
              <div
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {parent.status || "Active"}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditParent(parent);
                  }}
                  title="Edit parent profile"
                  className="p-1 rounded-lg text-[#888888] hover:text-[#0071E3] hover:bg-[#F4F4F5] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteParent(parent);
                  }}
                  title="Delete parent profile"
                  className="p-1 rounded-lg text-[#888888] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Current Health Context */}
            <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#F0F0F0] text-xs space-y-1 group-hover:bg-blue-50/20 transition-colors">
              <div className="text-[10px] font-semibold text-[#888888] uppercase tracking-wider">
                Current Status
              </div>
              <p className="text-[#222222] font-medium line-clamp-2">
                "{parent.currentStatusNote || "No concerning changes detected."}"
              </p>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#666666]">
              <div>
                <span className="text-[#888888]">Last Call:</span>
                <span className="text-[#111111] font-medium ml-1">
                  {parent.lastCallText || "Today"}
                </span>
              </div>
              <div>
                <span className="text-[#888888]">Next Call:</span>
                <span className="text-[#111111] font-medium ml-1">
                  {parent.nextCallText || "Tomorrow"}
                </span>
              </div>
            </div>

            {/* Quick Action Button */}
            <div
              className="pt-2 border-t border-[#F0F0F0] flex items-center justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[11px] text-[#888888] font-mono">
                {parent.parentPhone}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCallParent(parent);
                  }}
                  className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Phone className="w-3 h-3" />
                  <span>Call Now</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
}
