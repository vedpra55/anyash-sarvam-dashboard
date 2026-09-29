"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

interface AgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentSettingsModal({ isOpen, onClose }: AgentSettingsModalProps) {
  const [agentVersion, setAgentVersion] = useState("");
  const [source, setSource] = useState<string>("none");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg("");
    setSavedMsg("");
    setIsLoading(true);
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setAgentVersion(data.agent_version ? String(data.agent_version) : "");
        setSource(data.source || "none");
      })
      .catch(() => setErrorMsg("Failed to load settings"))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSavedMsg("");

    const version = Number(agentVersion);
    if (!Number.isInteger(version) || version < 1) {
      setErrorMsg("Agent version must be a whole number of 1 or more");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_version: version }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }
      setSource("dashboard");
      setSavedMsg(`Saved. New calls will use agent version ${version}.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const sourceLabel =
    source === "dashboard"
      ? "Saved from dashboard"
      : source === "env"
      ? "From SARVAM_APP_VERSION env var"
      : "Not set (calls default to version 12)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-[420px] bg-[#141619] border border-[#262A31] rounded-3xl p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Agent settings</h2>
            <p className="text-xs text-[#8E929A] mt-1">
              Which Sarvam agent version outbound calls use.
            </p>
          </div>
          <button
            type="button"
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

        {savedMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300">
            {savedMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#C3C7D0]">Agent version</label>
            <input
              type="number"
              min={1}
              step={1}
              value={agentVersion}
              disabled={isLoading}
              onChange={(e) => setAgentVersion(e.target.value)}
              placeholder={isLoading ? "Loading..." : "e.g. 26"}
              className="w-full px-3.5 py-2.5 bg-[#1B1E22] border border-[#2A2E35] focus:border-[#FEE5A5] rounded-xl text-sm text-white placeholder-[#5A606C] outline-none transition-colors"
            />
            <p className="text-[11px] text-[#717680]">{isLoading ? "" : sourceLabel}</p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full bg-[#1C1F24] hover:bg-[#252830] text-xs font-medium text-white transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="px-5 py-2.5 rounded-full bg-[#FEE5A5] hover:bg-[#FDE047] active:scale-95 text-xs font-semibold text-[#18181B] transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
