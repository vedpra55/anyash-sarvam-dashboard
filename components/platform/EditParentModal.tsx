"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Phone,
  Globe,
  HeartPulse,
  Activity,
  Calendar,
  Check,
  Save,
  AlertCircle,
} from "lucide-react";
import { ParentProfile, SupportedLanguage, ParentOperationalStatus } from "@/lib/types";

interface EditParentModalProps {
  parent: ParentProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: ParentProfile) => void;
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

const STATUSES: ParentOperationalStatus[] = ["Active", "Pending", "Paused"];

export function EditParentModal({
  parent,
  isOpen,
  onClose,
  onSave,
}: EditParentModalProps) {
  const [formData, setFormData] = useState<ParentProfile | null>(null);
  const [conditionsInput, setConditionsInput] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (parent) {
      setFormData({ ...parent });
      setConditionsInput(parent.knownConditions?.join(", ") || "");
    }
  }, [parent, isOpen]);

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.parentName.trim()) return;

    const conditions = conditionsInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const updated: ParentProfile = {
      ...formData,
      knownConditions: conditions,
      familyRelation: formData.childName ? `Family: ${formData.childName}` : formData.familyRelation,
    };

    onSave(updated);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-[#EAEAEA] flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAEAEA] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center font-bold text-sm">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-[#111111]">
                Edit Parent Profile
              </h2>
              <p className="text-[12px] text-[#666666]">
                Update contact, language, health baselines & care circle
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#F4F4F5] text-[#888888] hover:text-[#111111] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* 1. Name & Honorific */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                Parent Name *
              </label>
              <input
                type="text"
                required
                value={formData.parentName}
                onChange={(e) =>
                  setFormData({ ...formData, parentName: e.target.value })
                }
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs text-[#111111] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] focus:border-[#0071E3] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                Honorific
              </label>
              <input
                type="text"
                value={formData.honorific || "Ji"}
                onChange={(e) =>
                  setFormData({ ...formData, honorific: e.target.value })
                }
                placeholder="Ji / Mummy Ji"
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs text-[#111111] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] focus:border-[#0071E3] outline-none"
              />
            </div>
          </div>

          {/* 2. Phone, Age & Language */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={formData.parentPhone}
                onChange={(e) =>
                  setFormData({ ...formData, parentPhone: e.target.value })
                }
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs font-mono text-[#111111] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] focus:border-[#0071E3] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                Age
              </label>
              <input
                type="number"
                value={formData.age || 60}
                onChange={(e) =>
                  setFormData({ ...formData, age: parseInt(e.target.value, 10) || 60 })
                }
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs text-[#111111] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] focus:border-[#0071E3] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                Language
              </label>
              <select
                value={formData.preferredLanguage}
                onChange={(e) =>
                  setFormData({ ...formData, preferredLanguage: e.target.value as SupportedLanguage })
                }
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs text-[#111111] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] focus:border-[#0071E3] outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Operational Status & Family Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                Operational Status
              </label>
              <select
                value={formData.status || "Active"}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as ParentOperationalStatus })
                }
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs text-[#111111] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] focus:border-[#0071E3] outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                Child / Family Contact Name
              </label>
              <input
                type="text"
                value={formData.childName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, childName: e.target.value })
                }
                placeholder="e.g. Priya Sharma (Daughter)"
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs text-[#111111] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] focus:border-[#0071E3] outline-none"
              />
            </div>
          </div>

          {/* 4. Current Status Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
              Current Health Status Note
            </label>
            <textarea
              rows={2}
              value={formData.currentStatusNote || ""}
              onChange={(e) =>
                setFormData({ ...formData, currentStatusNote: e.target.value })
              }
              placeholder="e.g. Knee pain mentioned yesterday, following up tomorrow"
              className="w-full bg-[#F5F5F7] focus:bg-white text-xs text-[#111111] p-3 rounded-xl border border-[#E5E5E5] focus:border-[#0071E3] outline-none resize-none"
            />
          </div>

          {/* number_of_calls setting */}
          <div className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#E5E5E5] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#111111] font-mono">number_of_calls</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  (Number(formData.number_of_calls) || 1) <= 1 ? "bg-blue-100 text-[#0071E3]" : "bg-emerald-100 text-emerald-800"
                }`}>
                  Call #{Number(formData.number_of_calls) || 1}
                </span>
              </div>
              <p className="text-[11px] text-[#666666] mt-0.5">
                {(Number(formData.number_of_calls) || 1) <= 1
                  ? "Call #1: Initial baseline intro & onboarding"
                  : `Call #${formData.number_of_calls}: Ongoing check-in follow-up`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-[#E5E5E5] rounded-lg p-1">
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    number_of_calls: Math.max(1, (Number(formData.number_of_calls) || 1) - 1),
                  })
                }
                className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-[#666666] hover:bg-[#F0F0F2]"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={formData.number_of_calls ?? 1}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    number_of_calls: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                className="w-10 text-center font-mono text-xs font-bold text-[#111111] bg-transparent outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    number_of_calls: (Number(formData.number_of_calls) || 1) + 1,
                  })
                }
                className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-[#666666] hover:bg-[#F0F0F2]"
              >
                +
              </button>
            </div>
          </div>

          {/* 5. Tracked Conditions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
              Tracked Conditions (comma-separated)
            </label>
            <input
              type="text"
              value={conditionsInput}
              onChange={(e) => setConditionsInput(e.target.value)}
              placeholder="e.g. Hypertension, Mild Joint Stiffness, Osteoarthritis"
              className="w-full bg-[#F5F5F7] focus:bg-white text-xs text-[#111111] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] focus:border-[#0071E3] outline-none"
            />
          </div>

          {/* Footer Save Button */}
          <div className="pt-4 border-t border-[#F0F0F0] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#666666] hover:bg-[#F4F4F5] rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              {savedNotice ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Parent</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
