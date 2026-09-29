"use client";

import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { ParentProfile } from "@/lib/types";

interface DeleteParentModalProps {
  parent: ParentProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (parentId: string) => void;
}

export function DeleteParentModal({
  parent,
  isOpen,
  onClose,
  onConfirmDelete,
}: DeleteParentModalProps) {
  if (!isOpen || !parent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#EAEAEA] overflow-hidden p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Trash2 className="w-5 h-5" />
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-[#F4F4F5] text-[#888888] hover:text-[#111111] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="text-base font-semibold text-[#111111]">
            Delete {parent.parentName}?
          </h3>
          <p className="text-xs text-[#666666] mt-1.5 leading-relaxed">
            Are you sure you want to remove <strong>{parent.parentName}</strong> ({parent.parentPhone})?
            This will permanently remove their profile and cease all autonomous check-in calls and memory tracking.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#F0F0F0]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#666666] hover:bg-[#F4F4F5] rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmDelete(parent.id);
              onClose();
            }}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Parent</span>
          </button>
        </div>
      </div>
    </div>
  );
}
