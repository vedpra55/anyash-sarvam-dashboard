"use client";

import React from "react";
import { ParentProfile, Medication } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Activity,
  Pill,
  Clock,
  ShieldCheck,
  CheckCircle2,
  CalendarCheck2,
  AlertCircle,
  Plus,
} from "lucide-react";

interface LivingSummaryCardProps {
  profile: ParentProfile;
  onToggleMedication?: (medId: string) => void;
  onEditProfile: () => void;
}

export function LivingSummaryCard({
  profile,
  onToggleMedication,
  onEditProfile,
}: LivingSummaryCardProps) {
  const getTimingBadge = (timing: Medication["timing"]) => {
    switch (timing) {
      case "morning":
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">Morning</span>;
      case "afternoon":
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">Afternoon</span>;
      case "evening":
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">Evening</span>;
      case "night":
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">Night</span>;
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-teal-400" />
          </div>
          <CardTitle className="text-base font-semibold text-slate-100">
            Living Health Context
          </CardTitle>
        </div>
        <button
          onClick={onEditProfile}
          className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors"
        >
          Edit Profile
        </button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Conditions Tags */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Known Conditions
          </span>
          <div className="flex flex-wrap gap-1.5">
            {profile.knownConditions.map((cond, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-xs py-0.5 px-2.5 bg-slate-800/80 text-slate-200 border border-slate-700/60 font-normal"
              >
                {cond}
              </Badge>
            ))}
          </div>
        </div>

        {/* Medication Schedule Chips */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Today's Medications
            </span>
            <span className="text-[11px] text-slate-500">
              {profile.medications.filter((m) => m.takenToday).length} of{" "}
              {profile.medications.length} taken
            </span>
          </div>

          <div className="space-y-1.5">
            {profile.medications.map((med) => (
              <div
                key={med.id}
                onClick={() => onToggleMedication && onToggleMedication(med.id)}
                className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                  med.takenToday
                    ? "bg-slate-900/40 border-slate-800 text-slate-300"
                    : "bg-slate-850/80 border-slate-700/80 text-slate-100 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`h-5 w-5 rounded-full flex items-center justify-center ${
                      med.takenToday
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "border border-slate-600 text-slate-600"
                    }`}
                  >
                    {med.takenToday ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Pill className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <span
                      className={`text-xs font-medium block ${
                        med.takenToday ? "line-through text-slate-500" : ""
                      }`}
                    >
                      {med.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {med.dosage}
                    </span>
                  </div>
                </div>
                <div>{getTimingBadge(med.timing)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Follow-ups Checklist */}
        {profile.activeFollowUps.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Open Follow-ups for Next Call
            </span>
            <div className="space-y-1">
              {profile.activeFollowUps.map((fu, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-2 text-xs text-slate-300 py-1 px-2 rounded-lg bg-slate-950/40 border border-slate-800/60"
                >
                  <Clock className="h-3.5 w-3.5 text-teal-400 mt-0.5 flex-shrink-0" />
                  <span>{fu}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Contact */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Emergency Contact:</span>
          </div>
          <span className="text-slate-200 font-medium">
            {profile.emergencyContact.name} ({profile.emergencyContact.phone})
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
