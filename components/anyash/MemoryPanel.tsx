"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { parseMemory, diffMemory, isEmptyMemory } from "@/lib/memory";
import {
  Section,
  MemoryDocument,
  MemoryDiffView,
  summarizeDiff,
  formatDateTime,
  formatRelative,
  formatDuration,
  humanize,
} from "./detail-ui";

interface MemoryHistoryItem {
  attempt_id: string;
  created_at: string;
  call_outcome?: string;
  duration_seconds?: number | string;
  previous_user_context?: string | null;
  resulting_user_context?: string | null;
}

interface MemoryPanelProps {
  parentId: string;
  parentName: string;
  onOpenCall?: (attemptId: string) => void;
  onSaved?: (memory: string) => void;
}

function HistoryRow({
  item,
  onOpenCall,
}: {
  item: MemoryHistoryItem;
  onOpenCall?: (attemptId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { diff, after } = useMemo(() => {
    const before = parseMemory(item.previous_user_context);
    const after = parseMemory(item.resulting_user_context);
    return { diff: diffMemory(before, after), after };
  }, [item.previous_user_context, item.resulting_user_context]);

  return (
    <li>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full grid grid-cols-[16px_150px_1fr] items-baseline gap-x-3 py-3 text-left group"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 transition-transform self-center ${open ? "rotate-90" : ""}`}
        />
        <span className="text-[13px] text-zinc-300">{formatDateTime(item.created_at)}</span>
        <span className="text-[13px] text-zinc-500 truncate">{summarizeDiff(diff)}</span>
      </button>
      {open && (
        <div className="pl-[28px] pb-6">
          <MemoryDiffView diff={diff} after={after} />
          <div className="mt-4 flex items-center gap-4 text-[12px] text-zinc-600">
            {item.call_outcome && <span>{humanize(item.call_outcome)}</span>}
            {Number(item.duration_seconds) > 0 && <span>{formatDuration(item.duration_seconds)}</span>}
            {onOpenCall && (
              <button onClick={() => onOpenCall(item.attempt_id)} className="text-zinc-400 hover:text-white transition-colors">
                Open call →
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function MemoryPanel({ parentId, parentName, onOpenCall, onSaved }: MemoryPanelProps) {
  const [memory, setMemory] = useState("");
  const [numberOfCalls, setNumberOfCalls] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<MemoryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/parents/${parentId}/memory`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load memory");
      setMemory(data.memory || "");
      setNumberOfCalls(data.numberOfCalls ?? null);
      setUpdatedAt(data.lastCallAt || data.updatedAt || null);
      setHistory(data.history || []);
    } catch (err: any) {
      setLoadError(err.message || "Failed to load memory");
    } finally {
      setIsLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    setIsEditing(false);
    load();
  }, [load]);

  const parsed = useMemo(() => parseMemory(memory), [memory]);
  const firstName = parentName.split(" ")[0];

  const startEditing = () => {
    setDraft(memory);
    setSaveError("");
    setIsEditing(true);
  };

  const save = async () => {
    if (!draft.trim()) {
      setSaveError("Memory can't be empty.");
      return;
    }
    setIsSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/parents/${parentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_user_context: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      const saved = data.parent?.current_user_context ?? draft.trim();
      setMemory(saved);
      setUpdatedAt(data.parent?.updated_at || new Date().toISOString());
      setIsEditing(false);
      onSaved?.(saved);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-[13px] text-zinc-600">Loading memory…</p>;
  }

  if (loadError) {
    return (
      <div>
        <p className="text-[14px] text-zinc-300">Couldn&apos;t load Anya&apos;s memory.</p>
        <p className="text-[13px] text-zinc-500 mt-1">{loadError}</p>
        <button onClick={load} className="mt-3 text-[13px] text-zinc-300 hover:text-white">
          Try again
        </button>
      </div>
    );
  }

  const subtitle = [
    numberOfCalls ? `Anya reads this at the start of call ${numberOfCalls}` : "Anya reads this at the start of every call",
    updatedAt ? `updated ${formatRelative(updatedAt)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="max-w-[760px]">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-[17px] font-semibold text-white tracking-tight">What Anya remembers about {firstName}</h2>
          <p className="text-[13px] text-zinc-500 mt-1">{subtitle}</p>
        </div>
        {!isEditing && (
          <button
            onClick={startEditing}
            className="px-3.5 py-1.5 rounded-full text-[13px] text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.09] transition-colors shrink-0"
          >
            Edit memory
          </button>
        )}
      </div>

      <div className="pt-7">
        {isEditing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              autoFocus
              className="w-full min-h-[380px] p-4 rounded-xl bg-white/[0.03] focus:bg-white/[0.045] outline-none ring-1 ring-white/[0.08] focus:ring-[#FEE5A5]/50 font-mono text-[12.5px] leading-6 text-zinc-200 resize-y transition-colors"
            />
            <p className="text-[12px] text-zinc-500 mt-2 leading-5">
              Anya receives this text exactly as written. Keep the section headings (BASELINE, ROUTINE, ROLLING LOG,
              ACTIVE WATCHLIST) so it stays readable here. The AI rewrites it after the next connected call.
            </p>
            {saveError && <p className="text-[13px] text-rose-300 mt-3">{saveError}</p>}
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={save}
                disabled={isSaving}
                className="px-4 py-2 rounded-full bg-[#FEE5A5] hover:bg-[#FDE8B0] text-[13px] font-medium text-black transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save memory"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="px-4 py-2 rounded-full text-[13px] text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : isEmptyMemory(parsed) ? (
          <div>
            <p className="text-[14px] text-zinc-300">Anya doesn&apos;t remember anything about {firstName} yet.</p>
            <p className="text-[13px] text-zinc-500 mt-1">Memory builds up automatically after each connected call.</p>
          </div>
        ) : (
          <MemoryDocument memory={parsed} />
        )}
      </div>

      {!isEditing && history.length > 0 && (
        <Section title="How memory changed" className="pt-12">
          <ul className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
            {history.map((item) => (
              <HistoryRow key={item.attempt_id} item={item} onOpenCall={onOpenCall} />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
