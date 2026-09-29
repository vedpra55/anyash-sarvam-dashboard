import { NextRequest, NextResponse } from "next/server";
import { calculateOverviewMetrics, calculateGoalsMetrics, calculateCallCosts } from "@/lib/analytics";
import { CallRecord, CallTranscriptTurn, DecisionCard } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.SARVAM_API_KEY || "";
    const orgId = process.env.SARVAM_ORG_ID || "";
    const workspaceId = process.env.SARVAM_WORKSPACE_ID || "";
    const appId = process.env.SARVAM_APP_ID || "";

    if (!apiKey || !orgId || !workspaceId || !appId) {
      return NextResponse.json(
        { error: "Sarvam environment variables not configured" },
        { status: 400 }
      );
    }

    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 30);
    const future = new Date();
    future.setDate(now.getDate() + 1);

    const attemptsUrl = `https://apps.sarvam.ai/api/analytics/v1/${orgId}/${workspaceId}/${appId}/attempts?start_datetime=${encodeURIComponent(
      past.toISOString()
    )}&end_datetime=${encodeURIComponent(future.toISOString())}`;

    const attemptsRes = await fetch(attemptsUrl, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey.trim(),
      },
      cache: "no-store",
    });

    if (!attemptsRes.ok) {
      const err = await attemptsRes.text();
      return NextResponse.json(
        { error: `Sarvam Analytics error: ${err}` },
        { status: attemptsRes.status }
      );
    }

    const attemptsData = await attemptsRes.json();
    const items: any[] = attemptsData.items || [];

    const calls: CallRecord[] = items.map((item) => {
      const isConnected = item.connectivity_status === "connected";
      const durationSeconds = Math.round(item.duration_in_seconds || 0);
      const costs = calculateCallCosts(durationSeconds, isConnected);
      const agentVars = item.agent_variables || {};

      let parentName =
        agentVars.parent_name ||
        item.user_contact ||
        item.user_identifier ||
        "Caller";

      const dateObj = item.start_datetime ? new Date(item.start_datetime) : new Date();

      return {
        attemptId: item.attempt_id,
        interactionId: item.interaction_id !== "NO_INTERACTION_ID" ? item.interaction_id : undefined,
        userIdentifier: item.user_contact || item.user_identifier || item.user_contact_hashed,
        profileId: `telephony-${item.attempt_id}`,
        parentName,
        timestamp: dateObj.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        dateOnly: dateObj.toLocaleDateString([], { month: "short", day: "numeric" }),
        status: isConnected ? "connected" : item.connectivity_status === "failed" ? "failed" : "no_answer",
        durationSeconds,
        summary: agentVars.call_summary || (isConnected ? "Check-in call connected" : "Call attempt"),
        failureReason: item.failure_reason !== "NO_FAILURE_REASON" ? item.failure_reason : undefined,
        audioUrl: item.audio_url || undefined,
        usageCostInr: costs.usageCostInr,
        telephonyCostInr: costs.telephonyCostInr,
        averageLatencyMs: item.average_agent_response_time_in_seconds ? Math.round(item.average_agent_response_time_in_seconds * 1000) : 480,
        numMessages: item.num_messages || 0,
        languageName: item.language_name || "Hindi",
        number_of_calls:
          agentVars.number_of_calls !== undefined
            ? agentVars.number_of_calls
            : agentVars.is_first_call === true || agentVars.is_first_call === "true"
              ? 1
              : 2,
        rawAgentVariables: agentVars,
      };
    });

    const overview = calculateOverviewMetrics(calls);
    const goals = calculateGoalsMetrics(calls);

    return NextResponse.json({
      success: true,
      totalAttempts: calls.length,
      overview,
      goals,
      calls,
    });
  } catch (err: any) {
    console.error("Analytics endpoint error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
