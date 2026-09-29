"use client";

import React from "react";
import { ParentProfile, VoiceHealthConfig } from "@/lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  HeartHandshake,
  Settings2,
  UserCheck,
  PhoneCall,
  UserPlus,
  RefreshCw,
} from "lucide-react";

interface HeaderProps {
  profiles: ParentProfile[];
  activeProfile: ParentProfile;
  config: VoiceHealthConfig;
  isSyncing?: boolean;
  onSync?: () => void;
  onSelectProfile: (id: string) => void;
  onOpenProfileModal: () => void;
  onOpenConfigModal: () => void;
}

export function Header({
  profiles,
  activeProfile,
  config,
  isSyncing = false,
  onSync,
  onSelectProfile,
  onOpenProfileModal,
  onOpenConfigModal,
}: HeaderProps) {
  const isTelephonyConfigured = Boolean(
    config.sarvamApiKey &&
      config.sarvamOrgId &&
      config.sarvamWorkspaceId &&
      config.connectionId &&
      config.agentPhoneNumber
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 shadow-md shadow-teal-500/20">
            <HeartHandshake className="h-5 w-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight text-white">
                Anya Health
              </span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-teal-500/30 text-teal-400">
                Voice Companion
              </Badge>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Support the family. Do not replace it.
            </p>
          </div>
        </div>

        {/* Profile Selector, Telephony Status & Sync */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Sync Button */}
          {onSync && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={isSyncing}
              className="h-9 px-3 rounded-xl border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-xs text-teal-300 font-medium flex items-center space-x-1.5"
              title="Sync latest live calls and transcripts from Sarvam"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-teal-400" : ""}`} />
              <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Sarvam"}</span>
            </Button>
          )}

          {/* Telephony Connection Pill */}
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                isTelephonyConfigured
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-teal-400"
              }`}
            />
            <span className="text-slate-300 font-medium">
              {isTelephonyConfigured ? "Sarvam Live" : "Ready"}
            </span>
          </div>

          {/* Profile Switcher Pills */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
            {profiles.map((p) => {
              const isActive = p.id === activeProfile.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProfile(p.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-teal-500 text-slate-950 font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span className="max-w-[120px] truncate">{p.parentName.split(" ")[0]}</span>
                </button>
              );
            })}
            <button
              onClick={onOpenProfileModal}
              title="Edit or Add Profile"
              className="px-2 py-1 text-slate-400 hover:text-teal-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Settings Trigger */}
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenConfigModal}
            className="h-9 w-9 rounded-xl border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300"
            title="Configure Sarvam Keys & Telephony"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
