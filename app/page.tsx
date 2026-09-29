"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/anyash/Sidebar";
import {
  ParentsListColumn,
  ParentItem,
} from "@/components/anyash/ParentsListColumn";
import { ParentDetailCanvas } from "@/components/anyash/ParentDetailCanvas";
import { AddParentModal } from "@/components/anyash/AddParentModal";
import { EditParentModal } from "@/components/anyash/EditParentModal";
import { CallModal } from "@/components/anyash/CallModal";
import { PhoneCall, CheckCircle, AlertCircle, Trash2 } from "lucide-react";

export default function AnyashApp() {
  const [parents, setParents] = useState<ParentItem[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAddParentOpen, setIsAddParentOpen] = useState(false);
  const [isEditParentOpen, setIsEditParentOpen] = useState(false);
  const [parentToEdit, setParentToEdit] = useState<ParentItem | null>(null);
  const [parentToDelete, setParentToDelete] = useState<ParentItem | null>(null);

  // Pre-call variables modal
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callingParent, setCallingParent] = useState<ParentItem | null>(null);

  // Call status state
  const [isCalling, setIsCalling] = useState(false);
  const [callToast, setCallToast] = useState<{
    type: "info" | "success" | "error";
    message: string;
  } | null>(null);

  // Fetch real parents from Supabase
  const loadParents = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/parents");
      if (res.ok) {
        const data = await res.json();
        const list: ParentItem[] = data.parents || [];
        setParents(list);

        // Auto-select first parent if none selected
        if (list.length > 0 && !selectedParentId) {
          setSelectedParentId(list[0].id);
        } else if (list.length > 0 && selectedParentId) {
          const exists = list.find((p) => p.id === selectedParentId);
          if (!exists) setSelectedParentId(list[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch parents:", e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedParentId]);

  useEffect(() => {
    loadParents();
  }, [loadParents]);

  // Selected parent object
  const activeParent =
    parents.find((p) => p.id === selectedParentId) || parents[0] || null;

  // Handlers
  const handleSelectParent = (parent: ParentItem) => {
    setSelectedParentId(parent.id);
  };

  const handleOpenAddParent = () => {
    setIsAddParentOpen(true);
  };

  const handleParentAdded = (newParent: ParentItem) => {
    setCallToast({
      type: "success",
      message: `${newParent.parent_name} added successfully!`,
    });
    setTimeout(() => setCallToast(null), 4000);
    loadParents();
    setSelectedParentId(newParent.id);
  };

  const handleOpenEditParent = (parent: ParentItem) => {
    setParentToEdit(parent);
    setIsEditParentOpen(true);
  };

  const handleParentUpdated = (updatedParent: ParentItem) => {
    setCallToast({
      type: "success",
      message: `Details updated for ${updatedParent.parent_name}.`,
    });
    setTimeout(() => setCallToast(null), 4000);
    loadParents();
  };

  const handleConfirmDelete = async () => {
    if (!parentToDelete) return;
    try {
      const res = await fetch(`/api/parents/${parentToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove parent");
      }
      setCallToast({
        type: "success",
        message: `${parentToDelete.parent_name} removed.`,
      });
      setTimeout(() => setCallToast(null), 4000);
      setParentToDelete(null);
      setSelectedParentId(null);
      loadParents();
    } catch (err: any) {
      setCallToast({
        type: "error",
        message: err.message || "Failed to remove parent",
      });
      setTimeout(() => setCallToast(null), 5000);
    }
  };

  // Open Call Modal to review variables before calling
  const handleOpenCallModal = (parent: ParentItem) => {
    setCallingParent(parent);
    setIsCallModalOpen(true);
  };

  // Dispatch the call after reviewing & editing variables
  const handleDispatchCall = async (payload: any) => {
    try {
      const langName = payload.customLanguage || payload.profile?.preferredLanguage || "Hindi";
      setIsCalling(true);
      setCallToast({
        type: "info",
        message: `Calling ${payload.profile?.honorific || payload.profile?.parentName} at ${payload.profile?.parentPhone} in ${langName}...`,
      });

      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch call");
      }

      setCallToast({
        type: "success",
        message: `Call dispatched successfully! Anya is calling ${payload.profile?.parentName} in ${langName}.`,
      });
      setTimeout(() => setCallToast(null), 6000);
      setIsCallModalOpen(false);

      // Re-fetch parent status after 10s to capture webhook output
      setTimeout(() => {
        loadParents();
      }, 10000);
    } catch (err: any) {
      setCallToast({
        type: "error",
        message: err.message || "Failed to trigger outbound call",
      });
      setTimeout(() => setCallToast(null), 6000);
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0C0D0E] text-[#D1D5DB] font-sans antialiased">
      {/* 1. Left Sidebar */}
      <Sidebar activeTab="parents" />

      {/* 2. Middle Column: Parents List */}
      <ParentsListColumn
        parents={parents}
        selectedParentId={selectedParentId}
        onSelectParent={handleSelectParent}
        onAddParentClick={handleOpenAddParent}
      />

      {/* 3. Right Column: Selected Parent Detail Canvas */}
      <ParentDetailCanvas
        parent={activeParent}
        onCallNow={handleOpenCallModal}
        onEditClick={handleOpenEditParent}
        onDeleteClick={(p) => setParentToDelete(p)}
        isCalling={isCalling}
      />

      {/* Modals */}
      <AddParentModal
        isOpen={isAddParentOpen}
        onClose={() => setIsAddParentOpen(false)}
        onSuccess={handleParentAdded}
      />

      <EditParentModal
        isOpen={isEditParentOpen}
        parent={parentToEdit}
        onClose={() => setIsEditParentOpen(false)}
        onSuccess={handleParentUpdated}
        onDelete={() => {
          setSelectedParentId(null);
          loadParents();
          setCallToast({
            type: "success",
            message: "Parent removed.",
          });
          setTimeout(() => setCallToast(null), 4000);
        }}
      />

      <CallModal
        isOpen={isCallModalOpen}
        parent={callingParent}
        onClose={() => setIsCallModalOpen(false)}
        onDispatchCall={handleDispatchCall}
        isCalling={isCalling}
      />

      {/* Confirmation Modal for Removing Parent */}
      {parentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
          <div className="w-full max-w-[420px] bg-[#121316] border border-[#262A32] rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-950/40 border border-rose-800/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Remove Parent Profile</h3>
                <p className="text-xs text-[#8E929A] mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-[#C3C7D0] leading-relaxed">
              Are you sure you want to remove <strong className="text-white">{parentToDelete.parent_name}</strong>?
              All associated daily logs and call records will be permanently deleted.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setParentToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1A1D23] hover:bg-[#22262E] border border-[#2A2E38] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-sm"
              >
                Remove Parent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Call Toast Notification */}
      {callToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#181A1E] border border-[#2D3139] shadow-2xl text-xs text-white animate-in slide-in-from-bottom-3 duration-200">
          {callToast.type === "info" && (
            <PhoneCall className="w-4 h-4 text-[#FEE5A5] animate-bounce shrink-0" />
          )}
          {callToast.type === "success" && (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          {callToast.type === "error" && (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{callToast.message}</span>
        </div>
      )}
    </div>
  );
}
