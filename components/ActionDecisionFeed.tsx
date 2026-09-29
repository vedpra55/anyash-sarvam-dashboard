"use client";

import React from "react";
import { DecisionCard, ParentProfile } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  HelpCircle,
  ShoppingBag,
  BellRing,
  Calendar,
  PhoneCall,
  Check,
} from "lucide-react";

interface ActionDecisionFeedProps {
  decisionCards: DecisionCard[];
  profile: ParentProfile;
  onToggleAction: (id: string) => void;
}

export function ActionDecisionFeed({
  decisionCards,
  profile,
  onToggleAction,
}: ActionDecisionFeedProps) {
  const profileDecisions = decisionCards.filter(
    (d) => d.profileId === profile.id
  );

  const getActionIcon = (type: DecisionCard["actionType"]) => {
    switch (type) {
      case "remind":
        return <BellRing className="h-4 w-4 text-teal-400" />;
      case "ask":
        return <HelpCircle className="h-4 w-4 text-blue-400" />;
      case "buy":
        return <ShoppingBag className="h-4 w-4 text-amber-400" />;
      case "schedule":
        return <Calendar className="h-4 w-4 text-purple-400" />;
      case "escalate":
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case "check":
      default:
        return <Send className="h-4 w-4 text-teal-400" />;
    }
  };

  const getUrgencyBadge = (urgency: DecisionCard["urgency"]) => {
    switch (urgency) {
      case "urgent":
        return <Badge variant="urgent">Urgent Action</Badge>;
      case "medium":
        return <Badge variant="warning">Needs Attention</Badge>;
      case "low":
      default:
        return <Badge variant="default">Routine Check</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-teal-400" />
          </div>
          <h2 className="text-base font-semibold text-slate-100">
            Action Decisions for {profile.childName}
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {profileDecisions.length} signals logged
        </span>
      </div>

      {profileDecisions.length === 0 ? (
        <Card className="border-dashed border-slate-800 bg-slate-900/30 p-8 text-center">
          <Clock className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-300">
            No health signals detected yet
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Start a check-in call with {profile.honorific} to capture health updates.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {profileDecisions.map((card) => (
            <Card
              key={card.id}
              className={`transition-all border ${
                card.actionCompleted
                  ? "border-slate-800/40 bg-slate-950/40 opacity-75"
                  : card.urgency === "urgent"
                  ? "border-red-500/40 bg-red-950/10 shadow-red-950/20"
                  : "border-slate-800/80 bg-slate-900/60 hover:border-slate-700/80"
              }`}
            >
              <CardContent className="p-4 sm:p-5">
                {/* Header line: Urgency & Time */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-2">
                    {getUrgencyBadge(card.urgency)}
                    <span className="text-xs text-slate-500 font-mono">
                      {card.timestamp}
                    </span>
                  </div>
                  <button
                    onClick={() => onToggleAction(card.id)}
                    className={`flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      card.actionCompleted
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                    }`}
                  >
                    {card.actionCompleted ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Completed</span>
                      </>
                    ) : (
                      <>
                        <span className="h-2 w-2 rounded-full border border-slate-400" />
                        <span>Mark Done</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Core Decision Loop: Observation & Interpretation */}
                <div className="space-y-2 mb-3.5">
                  <div className="flex items-start space-x-2 text-xs">
                    <span className="font-semibold text-slate-400 min-w-[80px]">
                      Observation:
                    </span>
                    <span className="text-slate-200">{card.observation}</span>
                  </div>
                  <div className="flex items-start space-x-2 text-xs">
                    <span className="font-semibold text-teal-400/90 min-w-[80px]">
                      Interpretation:
                    </span>
                    <span className="text-slate-300">{card.interpretation}</span>
                  </div>
                </div>

                {/* Practical Action Button for the Adult Child */}
                <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <div className="h-6 w-6 rounded-md bg-slate-800 flex items-center justify-center flex-shrink-0">
                      {getActionIcon(card.actionType)}
                    </div>
                    <span className="text-xs font-medium text-slate-100">
                      {card.recommendedAction}
                    </span>
                  </div>
                  {card.uncertainty && (
                    <span className="text-[11px] text-slate-500 italic max-w-xs truncate">
                      ⚠️ {card.uncertainty}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
