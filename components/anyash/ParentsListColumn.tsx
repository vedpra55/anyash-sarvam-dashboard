"use client";

import React, { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { getParentStatus, ParentReview } from "@/lib/attention";
import { Dot, formatRelative } from "./detail-ui";
import { Button } from "./primitives";

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
  reviews?: ParentReview[];
  created_at?: string;
  updated_at?: string;
  number_of_calls?: number;
}

interface ParentsListColumnProps {
  parents: ParentItem[];
  selectedParentId: string | null;
  onSelectParent: (parent: ParentItem) => void;
  onAddParentClick: () => void;
  className?: string;
}

export function ParentsListColumn({
  parents,
  selectedParentId,
  onSelectParent,
  onAddParentClick,
  className = "",
}: ParentsListColumnProps) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const now = new Date();
    const q = query.trim().toLowerCase();
    return parents
      .filter(
        (p) =>
          !q ||
          p.parent_name.toLowerCase().includes(q) ||
          (p.child_name || "").toLowerCase().includes(q) ||
          (p.phone_number || "").includes(q)
      )
      .map((p) => ({ parent: p, status: getParentStatus(p, now) }))
      .sort((a, b) => a.status.rank - b.status.rank || a.parent.parent_name.localeCompare(b.parent.parent_name));
  }, [parents, query]);

  return (
    <div className={`w-full lg:w-[320px] shrink-0 lg:border-r border-ay-line flex flex-col min-h-0 ${className}`}>
      <div className="px-5 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-semibold text-white tracking-tight">
            Parents
            {parents.length > 0 && <span className="ml-2 text-[14px] font-normal text-zinc-600 tabular-nums">{parents.length}</span>}
          </h1>
          <Button size="sm" onClick={onAddParentClick} icon={<Plus className="w-3.5 h-3.5" />}>
            Add
          </Button>
        </div>
        {parents.length > 5 && (
          <div className="relative mt-4">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search parents"
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.04] outline-none focus:ring-1 focus:ring-ay-accent/50 text-[13px] text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {parents.length === 0 ? (
          <div className="px-3 py-8">
            <p className="text-[13px] text-zinc-400">No parents yet.</p>
            <button onClick={onAddParentClick} className="mt-2 text-[13px] text-ay-accent-ink hover:text-ay-accent">
              Add the first one
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-8 text-[13px] text-zinc-500">No one matches “{query}”.</p>
        ) : (
          <ul className="space-y-px">
            {rows.map(({ parent, status }) => {
              const selected = parent.id === selectedParentId;
              return (
                <li key={parent.id}>
                  <button
                    onClick={() => onSelectParent(parent)}
                    aria-current={selected ? "true" : undefined}
                    className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                      selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Dot tone={status.tone} />
                      <span className={`text-[14px] font-medium truncate ${selected ? "text-white" : "text-zinc-200"}`}>
                        {parent.parent_name}
                      </span>
                      <span className="ml-auto text-[12px] text-zinc-600 shrink-0 tabular-nums">
                        {status.lastCallAt ? formatRelative(status.lastCallAt) : ""}
                      </span>
                    </div>
                    <p className="mt-1 pl-4 text-[12.5px] text-zinc-500 truncate">
                      <span className={status.needsAttention ? "text-zinc-300" : ""}>{status.label}</span>
                      {status.reason && status.reason !== status.label && <span> · {status.reason}</span>}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
