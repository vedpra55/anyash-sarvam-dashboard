"use client";

import React, { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { ParentItem } from "./ParentsListColumn";

interface EditParentModalProps {
  isOpen: boolean;
  parent: ParentItem | null;
  onClose: () => void;
  onSuccess: (updatedParent: any) => void;
  onDelete?: (parentId: string) => void;
}

export function EditParentModal({
  isOpen,
  parent,
  onClose,
  onSuccess,
  onDelete,
}: EditParentModalProps) {
  const [parentName, setParentName] = useState("");
  const [honorific, setHonorific] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [childName, setChildName] = useState("");
  const [relationship, setRelationship] = useState("Daughter");
  const [routinesText, setRoutinesText] = useState("");
  const [baselineText, setBaselineText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleDelete = async () => {
    if (!parent) return;
    const confirmed = window.confirm(`Are you sure you want to remove ${parent.parent_name}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/parents/${parent.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove parent");
      }
      onDelete?.(parent.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to remove parent");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (parent) {
      setParentName(parent.parent_name || "");
      setHonorific(parent.honorific || "Mummy Ji");
      setPhoneNumber(parent.phone_number || "");
      setChildName(parent.child_name || parent.facts?.family_member || "");
      setRelationship(parent.facts?.relationship || "Child");

      // Extract routine text
      const rText = (parent.routines || [])
        .map((r: any) => `${r.time ? r.time + " " : ""}${r.activity}`)
        .join("; ");
      setRoutinesText(rText);

      // Extract conditions text
      const bText = (parent.medical_baseline?.conditions || []).join(", ");
      setBaselineText(bText);
    }
  }, [parent]);

  if (!isOpen || !parent) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !phoneNumber.trim()) {
      setErrorMsg("Parent's name and phone number are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch(`/api/parents/${parent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_name: parentName.trim(),
          honorific: honorific.trim() || "Mummy Ji",
          phone_number: phoneNumber.replace(/\s+/g, "").trim(),
          child_name: childName.trim(),
          facts: {
            ...parent.facts,
            relationship: relationship,
            family_member: childName.trim(),
          },
          routines_text: routinesText.trim(),
          baseline_text: baselineText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update parent");
      }

      onSuccess(data.parent);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update parent");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-[500px] bg-[#141619] border border-[#262A31] rounded-3xl p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Edit parent details</h2>
            <p className="text-xs text-[#8E929A] mt-1">
              Update routines, baseline conditions, or contact numbers.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1C1F24] hover:bg-[#252830] text-[#8E929A] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">Parent's full name</label>
            <input
              type="text"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">How should Anyash address them?</label>
            <input
              type="text"
              value={honorific}
              onChange={(e) => setHonorific(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">Phone number</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#C3C7D0]">Your name</label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#C3C7D0]">Relationship</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white outline-none transition-colors cursor-pointer"
              >
                <option value="Daughter">Daughter</option>
                <option value="Son">Son</option>
                <option value="Daughter-in-law">Daughter-in-law</option>
                <option value="Son-in-law">Son-in-law</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">Daily routines & habits</label>
            <input
              type="text"
              value={routinesText}
              onChange={(e) => setRoutinesText(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">Health baseline</label>
            <input
              type="text"
              value={baselineText}
              onChange={(e) => setBaselineText(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/40 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? "Removing..." : "Remove parent"}</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting || isSubmitting}
                className="px-5 py-2.5 rounded-full bg-[#1C1F24] hover:bg-[#252830] text-xs font-medium text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="px-5 py-2.5 rounded-full bg-[#FEE5A5] hover:bg-[#FDE047] active:scale-95 text-xs font-semibold text-[#18181B] transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
