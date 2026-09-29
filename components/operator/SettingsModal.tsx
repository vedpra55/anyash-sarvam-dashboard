"use client";

import React, { useState } from "react";
import { X, Key, Phone, Globe, Shield, Check, RefreshCw } from "lucide-react";
import { VoiceHealthConfig } from "@/lib/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceHealthConfig;
  onSave: (config: VoiceHealthConfig) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  config,
  onSave,
}: SettingsModalProps) {
  const [formData, setFormData] = useState<VoiceHealthConfig>(config);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-apple-modal border border-[#E5E7EB] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#F0F0F2] flex items-center justify-between bg-[#FBFBFC]">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1D1D1F]">
              Telephony & Agent Configuration
            </h2>
            <p className="text-[12px] text-[#6E6E73]">
              Manage Sarvam AI conversational model and Indian PSTN calling
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#F2F2F5] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>Sarvam API Key</span>
            </label>
            <input
              type="password"
              placeholder="e.g. 52c1e488-xxxx-xxxx-xxxx"
              value={formData.sarvamApiKey}
              onChange={(e) =>
                setFormData({ ...formData, sarvamApiKey: e.target.value })
              }
              className="w-full bg-[#F5F5F7] focus:bg-white text-xs font-mono text-[#1D1D1F] px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] focus:border-[#0071E3] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider">
                Sarvam Org ID
              </label>
              <input
                type="text"
                placeholder="4070a316-xxxx"
                value={formData.sarvamOrgId}
                onChange={(e) =>
                  setFormData({ ...formData, sarvamOrgId: e.target.value })
                }
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs font-mono text-[#1D1D1F] px-3.5 py-2 rounded-xl border border-[#E5E7EB] outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider">
                Workspace ID
              </label>
              <input
                type="text"
                placeholder="4070a316-xxxx"
                value={formData.sarvamWorkspaceId}
                onChange={(e) =>
                  setFormData({ ...formData, sarvamWorkspaceId: e.target.value })
                }
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs font-mono text-[#1D1D1F] px-3.5 py-2 rounded-xl border border-[#E5E7EB] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider">
                App ID
              </label>
              <input
                type="text"
                placeholder="cb61ee16-xxxx"
                value={formData.sarvamAppId}
                onChange={(e) =>
                  setFormData({ ...formData, sarvamAppId: e.target.value })
                }
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs font-mono text-[#1D1D1F] px-3.5 py-2 rounded-xl border border-[#E5E7EB] outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3 h-3 text-[#0071E3]" />
                <span>Agent Phone Number</span>
              </label>
              <input
                type="text"
                placeholder="+91804736XXXX"
                value={formData.agentPhoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, agentPhoneNumber: e.target.value })
                }
                className="w-full bg-[#F5F5F7] focus:bg-white text-xs font-mono text-[#1D1D1F] px-3.5 py-2 rounded-xl border border-[#E5E7EB] outline-none"
              />
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="pt-4 border-t border-[#F0F0F2] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#424245] hover:bg-[#F5F5F7] rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0066CC] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Credentials</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
