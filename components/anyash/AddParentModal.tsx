"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

interface AddParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newParent: any) => void;
}

export function AddParentModal({
  isOpen,
  onClose,
  onSuccess,
}: AddParentModalProps) {
  const [parentName, setParentName] = useState("");
  const [honorific, setHonorific] = useState("Mummy Ji");
  const [phoneNumber, setPhoneNumber] = useState("+91 ");
  const [language, setLanguage] = useState("Hindi");
  const [childName, setChildName] = useState("");
  const [relationship, setRelationship] = useState("Daughter");
  const [routinesText, setRoutinesText] = useState("");
  const [baselineText, setBaselineText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !phoneNumber.trim()) {
      setErrorMsg("Parent's name and phone number are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch("/api/parents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_name: parentName.trim(),
          honorific: honorific.trim() || "Mummy Ji",
          phone_number: phoneNumber.replace(/\s+/g, "").trim(),
          preferred_language: language,
          child_name: childName.trim() || "Family",
          relationship: relationship,
          routines_text: routinesText.trim(),
          baseline_text: baselineText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add parent");
      }

      onSuccess(data.parent);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
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
            <h2 className="text-xl font-bold text-white tracking-tight">Add parent</h2>
            <p className="text-xs text-[#8E929A] mt-1">
              Add their details so Anyash can call them daily.
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
          {/* Parent Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">Parent's full name</label>
            <input
              type="text"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Sunita Sharma"
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
          </div>

          {/* Honorific */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">How should Anyash address them?</label>
            <input
              type="text"
              value={honorific}
              onChange={(e) => setHonorific(e.target.value)}
              placeholder="Mummy Ji"
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">Phone number</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 8409527846"
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
          </div>

          {/* Preferred Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">Preferred language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white outline-none transition-colors cursor-pointer"
            >
              <option value="Hindi">Hindi</option>
              <option value="Hinglish">Hinglish</option>
              <option value="English">English</option>
              <option value="Marathi">Marathi</option>
              <option value="Gujarati">Gujarati</option>
              <option value="Bengali">Bengali</option>
              <option value="Punjabi">Punjabi</option>
            </select>
          </div>

          {/* Two-Column Child & Relation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#C3C7D0]">Your name</label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="Priya"
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

          {/* Daily routines & habits */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">Daily routines & habits</label>
            <input
              type="text"
              value={routinesText}
              onChange={(e) => setRoutinesText(e.target.value)}
              placeholder="6:30 AM garden walk; 8:30 AM breakfast & BP pill"
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
          </div>

          {/* Health baseline */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">Health baseline</label>
            <input
              type="text"
              value={baselineText}
              onChange={(e) => setBaselineText(e.target.value)}
              placeholder="Hypertension on Amlodipine, mild knee stiffness"
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
          </div>

          {/* Bottom Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-[#1C1F24] hover:bg-[#252830] text-xs font-medium text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full bg-[#FEE5A5] hover:bg-[#FDE047] active:scale-95 text-xs font-semibold text-[#18181B] transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add parent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
