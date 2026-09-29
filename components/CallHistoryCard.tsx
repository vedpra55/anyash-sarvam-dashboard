"use client";

import React, { useState } from "react";
import { CallRecord, ParentProfile } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  History,
  PhoneCall,
  PhoneMissed,
  ChevronDown,
  ChevronUp,
  User,
  Bot,
  Clock,
  Sparkles,
  RefreshCw,
  Volume2,
} from "lucide-react";

interface CallHistoryCardProps {
  calls: CallRecord[];
  profile: ParentProfile;
  isSyncing?: boolean;
  onSync?: () => void;
}

export function CallHistoryCard({
  calls,
  profile,
  isSyncing = false,
  onSync,
}: CallHistoryCardProps) {
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(
    null
  );

  // Filter for profile, but show all if none match profile specifically
  const profileCalls =
    calls.filter((c) => c.profileId === profile.id).length > 0
      ? calls.filter((c) => c.profileId === profile.id)
      : calls;

  const toggleExpand = (attemptId: string) => {
    setExpandedAttemptId(expandedAttemptId === attemptId ? null : attemptId);
  };

  const getStatusBadge = (status: CallRecord["status"]) => {
    switch (status) {
      case "connected":
        return <Badge variant="success">Connected</Badge>;
      case "busy":
        return <Badge variant="warning">Busy</Badge>;
      case "no_answer":
        return <Badge variant="secondary">No Answer</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "in_progress":
        return <Badge variant="default" className="animate-pulse">Active</Badge>;
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
            <History className="h-4 w-4 text-teal-400" />
          </div>
          <CardTitle className="text-base font-semibold text-slate-100">
            Recent Check-in Calls
          </CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          {onSync && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="text-xs text-teal-400 hover:text-teal-300 flex items-center space-x-1 transition-colors p-1"
              title="Refresh calls from Sarvam"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
              <span className="text-[11px]">Sync</span>
            </button>
          )}
          <span className="text-xs text-slate-400 font-mono">
            {profileCalls.length} calls
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5">
        {profileCalls.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            <p>No check-in calls recorded yet.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Tap "Start Check-in Call" or "Sync" to pull calls from Sarvam.
            </p>
          </div>
        ) : (
          profileCalls.map((call) => {
            const isExpanded = expandedAttemptId === call.attemptId;
            return (
              <div
                key={call.attemptId}
                className="rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden transition-all"
              >
                <div
                  onClick={() => toggleExpand(call.attemptId)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center">
                      <PhoneCall className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-200 block">
                        {call.timestamp}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {call.durationSeconds > 0
                          ? `${Math.floor(call.durationSeconds / 60)}m ${
                              call.durationSeconds % 60
                            }s`
                          : "0s"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {getStatusBadge(call.status)}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 space-y-2.5 text-xs">
                    {/* Transcript if available */}
                    {call.transcript && call.transcript.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60 mb-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-400">
                            Verified Live Conversation Transcript
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {call.transcript.length} turns
                          </span>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {call.transcript.map((t, idx) => (
                            <div
                              key={idx}
                              className={`flex items-start space-x-2 text-xs ${
                                t.role === "agent"
                                  ? "text-teal-200"
                                  : "text-slate-200"
                              }`}
                            >
                              <div className="h-4 w-4 rounded bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                                {t.role === "agent" ? (
                                  <Bot className="h-2.5 w-2.5 text-teal-400" />
                                ) : (
                                  <User className="h-2.5 w-2.5 text-blue-400" />
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-400 mr-1">
                                  {t.role === "agent" ? "Anya:" : `${profile.honorific}:`}
                                </span>
                                <span>{t.text}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        No spoken transcript turns recorded for this call attempt.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
