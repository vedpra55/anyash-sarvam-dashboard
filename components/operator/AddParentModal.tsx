"use client";

import React, { useState } from "react";
import { X, Sparkles, Phone, User, Globe, ArrowRight } from "lucide-react";
import { ParentProfile, SupportedLanguage } from "@/lib/types";

interface AddParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddParent: (newParent: ParentProfile) => void;
}

const LANGUAGES: SupportedLanguage[] = [
  "Hindi",
  "English",
  "Hinglish",
  "Tamil",
  "Telugu",
  "Marathi",
  "Bengali",
  "Kannada",
  "Gujarati",
  "Punjabi",
];

export function AddParentModal({
  isOpen,
  onClose,
  onAddParent,
}: AddParentModalProps) {
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("+91 ");
  const [language, setLanguage] = useState<SupportedLanguage>("Hindi");
  const [childRelation, setChildRelation] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim()) return;

    const newProfile: ParentProfile = {
      id: `profile-${Date.now()}`,
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim() || "+91 98765 00000",
      honorific: "Ji",
      preferredLanguage: language,
      childName: childRelation.trim() || "Family",
      childPhone: "",
      emergencyContact: {
        name: childRelation.trim() || "Family Contact",
        phone: "",
        relationship: "Family",
      },
      status: "Active",
      age: 60,
      familyRelation: childRelation.trim() ? `Family: ${childRelation.trim()}` : "Family Enrolled",
      lastCallText: "—",
      nextCallText: "Today, Scheduled",
      riskFollowUp: "None",
      currentStatusNote: "Newly enrolled. Initial conversation scheduled.",
      knownConditions: [],
      medications: [],
      routines: [],
      activeFollowUps: ["Conduct initial baseline check-in call"],
      avatarColor: "bg-blue-500",
      number_of_calls: 1,
    };

    onAddParent(newProfile);
    onClose();
    setParentName("");
    setParentPhone("+91 ");
    setChildRelation("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-apple-modal border border-[#E5E7EB] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#F0F0F2] flex items-center justify-between bg-[#FBFBFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[#1D1D1F]">
                Add Parent
              </h2>
              <p className="text-[11px] text-[#6E6E73]">
                Only 3 essentials. Anyash learns through conversation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-[#F2F2F5] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Variables Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 1. Parent Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>Parent Name</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Parent Name"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              className="w-full bg-[#F5F5F7] focus:bg-white text-sm text-[#1D1D1F] placeholder-[#86868B] px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all outline-none"
            />
          </div>

          {/* 2. Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>Phone Number</span>
            </label>
            <input
              type="tel"
              required
              placeholder="+91 98765 XXXXX"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              className="w-full bg-[#F5F5F7] focus:bg-white text-sm text-[#1D1D1F] placeholder-[#86868B] px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 font-mono transition-all outline-none"
            />
          </div>

          {/* 3. Preferred Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>Preferred Language</span>
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              className="w-full bg-[#F5F5F7] focus:bg-white text-sm text-[#1D1D1F] px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition-all outline-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          {/* Optional helper toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="text-xs text-[#0071E3] hover:underline"
            >
              {showOptional ? "Hide optional child name" : "+ Add family/child contact name (optional)"}
            </button>
            {showOptional && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="e.g. Daughter: Priya (+91...)"
                  value={childRelation}
                  onChange={(e) => setChildRelation(e.target.value)}
                  className="w-full bg-[#F5F5F7] text-xs text-[#1D1D1F] placeholder-[#86868B] px-3 py-2 rounded-lg border border-[#E5E7EB] outline-none"
                />
              </div>
            )}
          </div>

          {/* Bottom CTA: Start Anyash */}
          <div className="pt-3 border-t border-[#F0F0F2]">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0066CC] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
            >
              <span>Start Anyash</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-[#86868B] text-center mt-2.5">
              Anyash will place its first introductory check-in call automatically.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
