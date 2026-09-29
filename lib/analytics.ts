import {
  CallRecord,
  PlatformAnalyticsOverview,
  HourlyConnectivityPoint,
  GoalsAnalytics,
  CohortMetrics,
} from "./types";

/**
 * Calculate Usage and Telephony Costs in INR (matching Sarvam pricing in screenshot)
 * Usage: ₹4.50/min (or fraction thereof)
 * Telephony: ₹0.40/30s
 */
export function calculateCallCosts(durationSeconds: number, isConnected: boolean): {
  usageCostInr: number;
  telephonyCostInr: number;
} {
  if (!isConnected || durationSeconds <= 0) {
    return { usageCostInr: 0, telephonyCostInr: 0 };
  }
  const usageMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
  const telephonyUnits = Math.max(1, Math.ceil(durationSeconds / 30));

  return {
    usageCostInr: usageMinutes * 4.5,
    telephonyCostInr: telephonyUnits * 0.4,
  };
}

/**
 * Format seconds into mm:ss
 */
export function formatDurationMMSS(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Calculate Overview Metrics matching Image 1 & Image 3
 */
export function calculateOverviewMetrics(calls: CallRecord[]): PlatformAnalyticsOverview {
  const callsAttempted = calls.length;
  const connectedCallsList = calls.filter((c) => c.status === "connected");
  const connectedCalls = connectedCallsList.length;

  const totalDurationSeconds = connectedCallsList.reduce(
    (sum, c) => sum + (c.durationSeconds || 0),
    0
  );

  const avgCallDurationSeconds =
    connectedCalls > 0 ? Math.round(totalDurationSeconds / connectedCalls) : 0;
  const avgCallDurationFormatted = formatDurationMMSS(avgCallDurationSeconds);

  const totalMinutes = Math.round(totalDurationSeconds / 60);

  // Short calls: duration < 30s and > 0
  const shortCalls = connectedCallsList.filter(
    (c) => c.durationSeconds > 0 && c.durationSeconds < 30
  ).length;

  const connectivityRate =
    callsAttempted > 0 ? (connectedCalls / callsAttempted) * 100 : 0;

  // Latencies
  const latencies = calls
    .map((c) => c.averageLatencyMs)
    .filter((l): l is number => typeof l === "number" && l > 0);
  const latencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

  // Build 24-hour connectivity buckets (0..23)
  const hourMap = new Map<number, { attempted: number; connected: number }>();
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { attempted: 0, connected: 0 });
  }

  calls.forEach((c) => {
    let hour = new Date().getHours();
    if (c.timestamp) {
      const match = c.timestamp.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const meridiem = match[3]?.toUpperCase();
        if (meridiem === "PM" && h < 12) h += 12;
        if (meridiem === "AM" && h === 12) h = 0;
        hour = h % 24;
      }
    }
    const bucket = hourMap.get(hour);
    if (bucket) {
      bucket.attempted += 1;
      if (c.status === "connected") {
        bucket.connected += 1;
      }
    }
  });

  const formatHourLabel = (h: number): string => {
    if (h === 0) return "12AM";
    if (h === 12) return "12PM";
    if (h < 12) return `${h}AM`;
    return `${h - 12}PM`;
  };

  const hourlyData: HourlyConnectivityPoint[] = Array.from(hourMap.entries()).map(
    ([hour, data]) => {
      const rate = data.attempted > 0 ? (data.connected / data.attempted) * 100 : 0;
      return {
        hour,
        hourLabel: formatHourLabel(hour),
        connectivityRate: Math.round(rate),
        callsAttempted: data.attempted,
        callsConnected: data.connected,
      };
    }
  );

  // Group calls by date
  const todayLabel = new Date().toLocaleDateString([], { month: "short", day: "numeric" });
  const dailyTimelineMap = new Map<string, number>();
  calls.forEach((c) => {
    const d = c.dateOnly || c.timestamp?.split(",")[0] || todayLabel;
    dailyTimelineMap.set(d, (dailyTimelineMap.get(d) || 0) + 1);
  });

  const dailyTimeline = Array.from(dailyTimelineMap.entries()).map(([date, count]) => ({
    date,
    calls: count,
  }));

  return {
    callsAttempted,
    connectedCalls,
    connectivityRate,
    latencyMs,
    avgCallDurationFormatted,
    avgCallDurationSeconds,
    totalMinutes,
    shortCalls,
    callOutcomesCount: callsAttempted,
    topFailureReasonsCount: calls.filter((c) => c.status === "failed").length,
    hourlyData,
    dailyTimeline,
  };
}

/**
 * Calculate Goal & Cohort Analysis strictly from genuine calls
 */
export function calculateGoalsMetrics(calls: CallRecord[]): GoalsAnalytics {
  const connectedCalls = calls.filter((c) => c.status === "connected");
  const baseConnected = connectedCalls.length;

  // Eligible calls are connected check-in attempts where duration > 15s
  const eligibleCalls = connectedCalls.filter((c) => c.durationSeconds >= 15);
  const goalEligibleCalls = eligibleCalls.length;

  // Achieved calls are meaningful check-ins (duration > 50s or meaningful outcome)
  const achieved = eligibleCalls.filter(
    (c) =>
      c.rawAgentVariables?.call_outcome === "meaningful_checkin" ||
      c.durationSeconds >= 50
  );
  const goalAchievedCount = achieved.length;

  const notAchieved = eligibleCalls.filter((c) => !achieved.includes(c));
  const goalNotAchievedCount = notAchieved.length;

  const goalAchievementRate =
    goalEligibleCalls > 0 ? (goalAchievedCount / goalEligibleCalls) * 100 : 0;

  // Achieved Cohort Metrics
  const achievedDurations = achieved.map((c) => c.durationSeconds);
  const avgAchievedDurationSec =
    achievedDurations.length > 0
      ? Math.round(achievedDurations.reduce((a, b) => a + b, 0) / achievedDurations.length)
      : 0;

  const achievedTurns = achieved.map((c) => c.numMessages || c.transcript?.length || 0);
  const avgAchievedTurns =
    achievedTurns.length > 0
      ? parseFloat((achievedTurns.reduce((a, b) => a + b, 0) / achievedTurns.length).toFixed(1))
      : 0;

  const achievedLatencies = achieved
    .map((c) => c.averageLatencyMs)
    .filter((l): l is number => typeof l === "number" && l > 0);
  const avgAchievedLatencyMs =
    achievedLatencies.length > 0
      ? Math.round(achievedLatencies.reduce((a, b) => a + b, 0) / achievedLatencies.length)
      : 0;

  const achievedCohort: CohortMetrics = {
    callCount: goalAchievedCount,
    percentage: goalAchievementRate,
    baseConnected,
    avgCallDurationSeconds: avgAchievedDurationSec,
    avgCallDurationFormatted: formatDurationMMSS(avgAchievedDurationSec),
    avgTurnsPerCall: avgAchievedTurns,
    avgLatencyMs: avgAchievedLatencyMs,
  };

  // Not Achieved Cohort Metrics
  const notAchievedDurations = notAchieved.map((c) => c.durationSeconds);
  const avgNotAchievedDurationSec =
    notAchievedDurations.length > 0
      ? Math.round(notAchievedDurations.reduce((a, b) => a + b, 0) / notAchievedDurations.length)
      : 0;

  const notAchievedTurns = notAchieved.map((c) => c.numMessages || c.transcript?.length || 0);
  const avgNotAchievedTurns =
    notAchievedTurns.length > 0
      ? parseFloat((notAchievedTurns.reduce((a, b) => a + b, 0) / notAchievedTurns.length).toFixed(1))
      : 0;

  const notAchievedLatencies = notAchieved
    .map((c) => c.averageLatencyMs)
    .filter((l): l is number => typeof l === "number" && l > 0);
  const avgNotAchievedLatencyMs =
    notAchievedLatencies.length > 0
      ? Math.round(notAchievedLatencies.reduce((a, b) => a + b, 0) / notAchievedLatencies.length)
      : 0;

  const durationDiffPercent =
    avgAchievedDurationSec > 0
      ? Math.round(((avgNotAchievedDurationSec - avgAchievedDurationSec) / avgAchievedDurationSec) * 100)
      : 0;

  const turnsDiffPercent =
    avgAchievedTurns > 0
      ? Math.round(((avgNotAchievedTurns - avgAchievedTurns) / avgAchievedTurns) * 100)
      : 0;

  const latencyDiffMs = avgNotAchievedLatencyMs - avgAchievedLatencyMs;

  const notAchievedCohort: CohortMetrics = {
    callCount: goalNotAchievedCount,
    percentage:
      goalEligibleCalls > 0 ? (goalNotAchievedCount / goalEligibleCalls) * 100 : 0,
    baseConnected,
    avgCallDurationSeconds: avgNotAchievedDurationSec,
    avgCallDurationFormatted: formatDurationMMSS(avgNotAchievedDurationSec),
    avgTurnsPerCall: avgNotAchievedTurns,
    avgLatencyMs: avgNotAchievedLatencyMs,
    durationDiffPercent,
    turnsDiffPercent,
    latencyDiffMs,
  };

  // Turn distribution derived dynamically from actual calls
  const brackets = [
    { label: "1 - 5 turns", min: 1, max: 5 },
    { label: "6 - 10 turns", min: 6, max: 10 },
    { label: "11 - 15 turns", min: 11, max: 15 },
    { label: "16+ turns", min: 16, max: 999 },
  ];

  const turnDistribution = brackets.map((b) => {
    const achCount = achieved.filter((c) => {
      const turns = c.numMessages || c.transcript?.length || 0;
      return turns >= b.min && turns <= b.max;
    }).length;
    const notAchCount = notAchieved.filter((c) => {
      const turns = c.numMessages || c.transcript?.length || 0;
      return turns >= b.min && turns <= b.max;
    }).length;

    return {
      turnBracket: b.label,
      achievedPct: goalAchievedCount > 0 ? Math.round((achCount / goalAchievedCount) * 100) : 0,
      notAchievedPct: goalNotAchievedCount > 0 ? Math.round((notAchCount / goalNotAchievedCount) * 100) : 0,
    };
  });

  // Language split by cohort derived dynamically from actual calls
  const allLanguages = Array.from(
    new Set(eligibleCalls.map((c) => c.languageName || "Hindi"))
  );
  if (allLanguages.length === 0) allLanguages.push("Hindi");

  const languageSplit = allLanguages.map((lang) => {
    const achLangCount = achieved.filter((c) => (c.languageName || "Hindi") === lang).length;
    const notAchLangCount = notAchieved.filter((c) => (c.languageName || "Hindi") === lang).length;
    return {
      language: lang,
      achievedPct: goalAchievedCount > 0 ? Math.round((achLangCount / goalAchievedCount) * 100) : 0,
      notAchievedPct: goalNotAchievedCount > 0 ? Math.round((notAchLangCount / goalNotAchievedCount) * 100) : 0,
    };
  });

  return {
    goalAchievementRate,
    goalEligibleCalls,
    goalAchievedCount,
    avgTurnsToGoal: avgAchievedTurns,
    avgTurnsNotAchieved: avgNotAchievedTurns,
    achievedCohort,
    notAchievedCohort,
    turnDistribution,
    languageSplit,
  };
}
