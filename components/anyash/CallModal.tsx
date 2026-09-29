"use client";

import React, { useState, useEffect } from "react";
import { X, Minus, Plus, Pencil, Phone, Globe, ChevronDown } from "lucide-react";
import { ParentItem } from "./ParentsListColumn";
import { SupportedLanguage } from "@/lib/types";

interface CallModalProps {
  isOpen: boolean;
  parent: ParentItem | null;
  onClose: () => void;
  onDispatchCall: (payload: any) => Promise<void>;
  isCalling: boolean;
}

export const ALL_SUPPORTED_LANGUAGES: { id: SupportedLanguage; label: string; nativeName: string }[] = [
  { id: "Hindi", label: "Hindi", nativeName: "हिंदी" },
  { id: "English", label: "English", nativeName: "English" },
  { id: "Hinglish", label: "Hinglish", nativeName: "हिंग्लिश" },
  { id: "Tamil", label: "Tamil", nativeName: "தமிழ்" },
  { id: "Telugu", label: "Telugu", nativeName: "తెలుగు" },
  { id: "Kannada", label: "Kannada", nativeName: "ಕನ್ನಡ" },
  { id: "Marathi", label: "Marathi", nativeName: "मराठी" },
  { id: "Bengali", label: "Bengali", nativeName: "বাংলা" },
  { id: "Gujarati", label: "Gujarati", nativeName: "ગુજરાતી" },
  { id: "Punjabi", label: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { id: "Malayalam", label: "Malayalam", nativeName: "മലയാളം" },
  { id: "Odia", label: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { id: "Assamese", label: "Assamese", nativeName: "অসমীয়া" },
];

function formatPhoneDisplay(raw?: string): string {
  if (!raw) return "";
  const cleaned = raw.trim();
  // Format +91XXXXXXXXXX to +91 XXXXXXXXXX
  if (cleaned.startsWith("+91") && cleaned.length === 13) {
    return `+91 ${cleaned.slice(3)}`;
  }
  return cleaned;
}

export function CallModal({
  isOpen,
  parent,
  onClose,
  onDispatchCall,
  isCalling,
}: CallModalProps) {
  const [callNumber, setCallNumber] = useState<number>(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [language, setLanguage] = useState<SupportedLanguage>("Hindi");
  const [context, setContext] = useState("");

  useEffect(() => {
    if (parent) {
      // 1. Initial Call Number from Supabase / Parent profile
      // Math: Profile creation = 1. After 1st call = 2.
      const count =
        typeof parent.number_of_calls === "number" && parent.number_of_calls > 0
          ? parent.number_of_calls
          : parent.calls && parent.calls.length > 0
          ? parent.calls.length + 1
          : 1;
      setCallNumber(count);

      // 2. Initial Phone Number from Supabase
      setPhoneNumber(formatPhoneDisplay(parent.phone_number || "+91 8409527846"));

      // 3. Initial Language from parent profile / facts
      const initialLang =
        (parent.facts?.language as SupportedLanguage) ||
        ((parent as any).preferredLanguage as SupportedLanguage) ||
        ((parent as any).language as SupportedLanguage) ||
        "Hindi";
      setLanguage(initialLang);

      // 4. Exact user_context from Supabase as plain text
      const supabaseUserContext =
        parent.current_user_context || (parent as any).user_context || "";
      setContext(supabaseUserContext);
    }
  }, [parent]);

  const handleUpdateCallNumber = (newCount: number) => {
    const valid = Math.max(1, newCount);
    setCallNumber(valid);
    // Dynamically synchronize CALL COUNT: X in the context text so user preview matches the stepper
    setContext((prev) => {
      if (prev && /CALL COUNT:\s*\d+/i.test(prev)) {
        return prev.replace(/CALL COUNT:\s*\d+/i, `CALL COUNT: ${valid}`);
      }
      return prev;
    });
  };

  if (!isOpen || !parent) return null;

  // Pills: ensure currently selected or parent's language is always included in the quick pills row
  const quickPills: SupportedLanguage[] = Array.from(
    new Set<SupportedLanguage>([
      language,
      "Hindi",
      "English",
      "Hinglish",
      "Tamil",
      "Telugu",
      "Kannada",
      "Marathi",
    ])
  ).slice(0, 6);

  const handleStartCall = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/\s+/g, "");

    await onDispatchCall({
      profile: {
        id: parent.id,
        parentName: parent.parent_name,
        parentPhone: cleanPhone,
        childName: parent.child_name || parent.facts?.family_member || "Priya",
        honorific: parent.honorific || "Mummy Ji",
        preferredLanguage: language,
        number_of_calls: callNumber,
      },
      customLanguage: language,
      number_of_calls: callNumber,
      numberOfCalls: callNumber,
      user_context_override: context.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-[480px] bg-[#121316] border border-[#22242B] rounded-2xl p-6 shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs text-[#8E929A] font-medium block">Calling</span>
            <h2 className="text-2xl font-bold text-white tracking-tight mt-0.5">
              {parent.parent_name || "Sunita Sharma"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCalling}
            className="text-[#8E929A] hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleStartCall} className="space-y-4">
          {/* Section 1: Call # */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-white block">Call #</label>
            <p className="text-xs text-[#8E929A]">Which call is this for this parent?</p>
            <div className="inline-flex items-center bg-[#17191E] border border-[#262A32] rounded-xl overflow-hidden mt-1.5">
              <button
                type="button"
                onClick={() => handleUpdateCallNumber(callNumber - 1)}
                disabled={callNumber <= 1 || isCalling}
                className="w-12 h-10 flex items-center justify-center text-[#8E929A] hover:text-white hover:bg-[#20232A] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="w-14 h-10 flex items-center justify-center font-bold text-white text-sm select-none">
                {callNumber}
              </div>
              <button
                type="button"
                onClick={() => handleUpdateCallNumber(callNumber + 1)}
                disabled={isCalling}
                className="w-12 h-10 flex items-center justify-center text-[#8E929A] hover:text-white hover:bg-[#20232A] transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Section 2: Phone number */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-white block">Phone number</label>
            <p className="text-xs text-[#8E929A]">Update if needed.</p>
            <div className="relative flex items-center bg-[#17191E] border border-[#262A32] rounded-xl mt-1.5 focus-within:border-[#FEE5A5] transition-colors">
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isCalling}
                className="w-full bg-transparent px-4 py-2.5 text-sm text-white font-normal outline-none"
              />
              <Pencil className="w-4 h-4 text-[#717680] mr-4 shrink-0 pointer-events-none" />
            </div>
          </div>

          {/* Section 3: Language */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#FEE5A5]" />
                <span>Language</span>
              </label>
              <span className="text-[11px] text-[#8E929A] font-medium">Sarvam Multilingual</span>
            </div>
            <p className="text-xs text-[#8E929A]">Choose the language Anya will speak for this call.</p>

            {/* Custom Dropdown Selector */}
            <div className="relative mt-1.5">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                disabled={isCalling}
                className="w-full appearance-none bg-[#17191E] border border-[#262A32] rounded-xl px-4 py-2.5 text-sm text-white font-medium outline-none focus:border-[#FEE5A5] transition-colors cursor-pointer pr-10"
              >
                {ALL_SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id} className="bg-[#17191E] text-white">
                    {lang.label} ({lang.nativeName})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#717680] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Quick-Pick Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quickPills.map((lang) => {
                const info = ALL_SUPPORTED_LANGUAGES.find((l) => l.id === lang);
                const isSelected = language === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    disabled={isCalling}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      isSelected
                        ? "bg-[#FEE5A5] text-black font-semibold shadow-sm"
                        : "bg-[#17191E] text-[#8E929A] hover:text-white border border-[#262A32] hover:border-[#383D48]"
                    }`}
                  >
                    {info ? info.label : lang}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Context for this call */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-white block">Context for this call</label>
            <p className="text-xs text-[#8E929A]">Any important details, reminders or focus areas.</p>
            <textarea
              rows={4}
              maxLength={1500}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              disabled={isCalling}
              placeholder="Any important details, reminders or focus areas..."
              className="w-full bg-[#17191E] border border-[#262A32] rounded-xl p-3.5 text-xs text-white placeholder-[#5A606C] outline-none focus:border-[#FEE5A5] resize-none h-28 leading-relaxed mt-1.5 transition-colors font-mono"
            />
            <div className="text-right text-[11px] text-[#636873] mt-1 font-mono">
              {context.length}/1500
            </div>
          </div>

          {/* Section 5: Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCalling}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1A1D23] hover:bg-[#22262E] border border-[#2A2E38] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCalling}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-[#FEE5A5] hover:bg-[#fde08f] flex items-center gap-2 transition-all active:scale-95 shadow-sm disabled:opacity-50"
            >
              <Phone className="w-3.5 h-3.5 fill-black" />
              <span>{isCalling ? "Calling..." : "Call now"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
