"use client";

import React from "react";
import { GoalsAnalytics } from "@/lib/types";

interface GoalsAnalysisTabProps {
  goals: GoalsAnalytics;
}

export function GoalsAnalysisTab({ goals }: GoalsAnalysisTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. Header Metric Cards (Image 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Goal achievement rate */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-[12px] font-normal text-[#666666]">
            Goal achievement rate
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#111111] mt-1.5">
            {goals.goalAchievementRate.toFixed(2)}%
          </div>
          <div className="text-xs text-[#777777] mt-1">
            {goals.goalAchievedCount} of {goals.goalEligibleCalls} eligible
          </div>
        </div>

        {/* Avg turns to goal */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-[12px] font-normal text-[#666666]">
            Avg turns to goal
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#111111] mt-1.5">
            {goals.avgTurnsToGoal} turns
          </div>
          <div className="text-xs text-[#777777] mt-1">
            {goals.avgTurnsNotAchieved} turns in not-achieved cohort
          </div>
        </div>
      </div>

      {/* 2. Side-by-side Cohort Comparison (Image 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Goal achieved */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#111111]">
              Goal achieved
            </h3>
            <p className="text-[12px] text-[#666666] mt-0.5">
              {goals.achievedCohort.callCount} calls · {goals.achievedCohort.percentage.toFixed(2)}% of goal-eligible · base: {goals.achievedCohort.baseConnected} connected calls
            </p>
          </div>

          <div className="space-y-3 pt-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-[#F5F5F5]">
              <span className="text-[#666666]">Avg call duration</span>
              <span className="font-semibold text-[#111111] font-mono">
                {goals.achievedCohort.avgCallDurationFormatted}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-[#F5F5F5]">
              <span className="text-[#666666]">Avg turns per call</span>
              <span className="font-semibold text-[#111111]">
                {goals.achievedCohort.avgTurnsPerCall}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-[#666666]">Avg latency</span>
              <span className="font-semibold text-[#111111] font-mono">
                {goals.achievedCohort.avgLatencyMs} ms
              </span>
            </div>
          </div>
        </div>

        {/* Goal not achieved */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#111111]">
              Goal not achieved
            </h3>
            <p className="text-[12px] text-[#666666] mt-0.5">
              {goals.notAchievedCohort.callCount} calls · {goals.notAchievedCohort.percentage.toFixed(2)}% of goal-eligible · base: {goals.notAchievedCohort.baseConnected} connected calls
            </p>
          </div>

          <div className="space-y-3 pt-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-[#F5F5F5]">
              <span className="text-[#666666]">Avg call duration</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#111111] font-mono">
                  {goals.notAchievedCohort.avgCallDurationFormatted}
                </span>
                <span className="text-rose-600 font-medium">
                  {goals.notAchievedCohort.durationDiffPercent}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-[#F5F5F5]">
              <span className="text-[#666666]">Avg turns per call</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#111111]">
                  {goals.notAchievedCohort.avgTurnsPerCall}
                </span>
                <span className="text-rose-600 font-medium">
                  {goals.notAchievedCohort.turnsDiffPercent}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-[#666666]">Avg latency</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[#111111] font-mono">
                  {goals.notAchievedCohort.avgLatencyMs} ms
                </span>
                <span className="text-rose-600 font-medium">
                  {goals.notAchievedCohort.latencyDiffMs} ms
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Distribution Charts (Image 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Turn distribution by cohort */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#111111]">
              Turn distribution by cohort
            </h3>
            <p className="text-[12px] text-[#666666] mt-0.5">
              Achieved ↑ · Not achieved ↓ · % within each cohort
            </p>
          </div>

          <div className="pt-4 h-48 flex items-center justify-around border-b border-[#EAEAEA]">
            {goals.turnDistribution.map((t, idx) => (
              <div key={idx} className="flex flex-col items-center h-full justify-center">
                {/* Achieved green upward bar */}
                <div className="h-20 flex items-end">
                  {t.achievedPct > 0 && (
                    <div
                      className="w-4 rounded-t-sm bg-emerald-500"
                      style={{ height: `${t.achievedPct}%` }}
                    />
                  )}
                </div>
                {/* Center line */}
                <div className="w-12 h-[1px] bg-[#CCCCCC]" />
                {/* Not achieved red downward bar */}
                <div className="h-20 flex items-start">
                  {t.notAchievedPct > 0 && (
                    <div
                      className="w-4 rounded-b-sm bg-rose-500"
                      style={{ height: `${t.notAchievedPct}%` }}
                    />
                  )}
                </div>
                <span className="text-[10px] text-[#888888] mt-1 font-mono">
                  {t.turnBracket}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Language split by cohort */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#111111]">
              Language split by cohort
            </h3>
            <p className="text-[12px] text-[#666666] mt-0.5">
              Achieved ← · Not achieved → · % within each cohort
            </p>
          </div>

          <div className="pt-6 space-y-6">
            {goals.languageSplit.map((lang, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#333333] font-medium">
                  <span>{lang.language}</span>
                  <span className="text-[#888888]">
                    {lang.achievedPct}% Achieved · {lang.notAchievedPct}% Not achieved
                  </span>
                </div>
                <div className="flex h-3 w-full rounded-full overflow-hidden bg-[#F3F4F6]">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${lang.achievedPct}%` }}
                  />
                  <div
                    className="bg-rose-500 h-full"
                    style={{ width: `${lang.notAchievedPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
