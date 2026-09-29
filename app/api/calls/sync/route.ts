import { NextRequest, NextResponse } from "next/server";
import { CallRecord, CallTranscriptTurn, DecisionCard, ParentProfile } from "@/lib/types";
import { calculateCallCosts } from "@/lib/analytics";

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

    // Default time range: past 30 days to now + 1 day
    const now = new Date();
    const past = new Date();
    past.setDate(now.getDate() - 30);
    const future = new Date();
    future.setDate(now.getDate() + 1);

    const startIso = past.toISOString();
    const endIso = future.toISOString();

    const attemptsUrl = `https://apps.sarvam.ai/api/analytics/v1/${orgId}/${workspaceId}/${appId}/attempts?start_datetime=${encodeURIComponent(
      startIso
    )}&end_datetime=${encodeURIComponent(endIso)}`;

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
        { error: `Sarvam Analytics error (${attemptsRes.status}): ${err}` },
        { status: attemptsRes.status }
      );
    }

    const attemptsData = await attemptsRes.json();
    const items: any[] = attemptsData.items || [];

    // Sort items by attempted_at or start_datetime descending
    items.sort((a, b) => {
      const dateA = new Date(a.attempted_at || a.start_datetime || 0).getTime();
      const dateB = new Date(b.attempted_at || b.start_datetime || 0).getTime();
      return dateB - dateA;
    });

    const realCalls: CallRecord[] = [];
    const discoveredParents = new Map<string, Partial<ParentProfile>>();

    for (const item of items) {
      let transcriptTurns: CallTranscriptTurn[] = [];

      // Extract transcript if interaction_id exists
      if (
        item.interaction_id &&
        item.interaction_id !== "NO_INTERACTION_ID" &&
        item.num_messages > 0
      ) {
        try {
          const transcriptUrl = `https://apps.sarvam.ai/api/analytics/v1/${orgId}/${workspaceId}/${appId}/transcripts/${encodeURIComponent(
            item.interaction_id
          )}`;
          const tRes = await fetch(transcriptUrl, {
            headers: { "X-API-Key": apiKey.trim() },
            cache: "no-store",
          });
          if (tRes.ok) {
            const tData = await tRes.json();
            if (Array.isArray(tData.messages)) {
              transcriptTurns = tData.messages.map((m: any, idx: number) => ({
                turn_id: m.turn_id || idx + 1,
                role: m.role === "assistant" ? "agent" : "user",
                text: m.content || "",
                timestamp: m.timestamp || "Turn " + (idx + 1),
              }));
            }
          }
        } catch (tErr) {
          console.error("Failed to fetch transcript for interaction:", item.interaction_id, tErr);
        }
      }

      const agentVars = item.agent_variables || {};
      const durationSeconds = Math.round(item.duration_in_seconds || 0);
      const isConnected = item.connectivity_status === "connected";
      const costs = calculateCallCosts(durationSeconds, isConnected);

      // Determine parent name from agent variables or contact
      let parentName =
        agentVars.parent_name ||
        item.user_contact ||
        item.user_identifier ||
        "Caller";

      // Build genuine DecisionCard
      let decisionCard: DecisionCard | undefined = undefined;
      if (isConnected) {
        const observation =
          agentVars.health_update ||
          agentVars.call_summary ||
          (transcriptTurns.length > 0
            ? `${parentName} completed check-in call with Anyash.`
            : "Check-in call connected.");

        const interpretation =
          agentVars.call_summary ||
          `Call outcome: ${agentVars.call_outcome || "Completed"}. Signal: ${
            agentVars.conversation_signal || "Normal"
          }.`;

        const followUp = agentVars.follow_up_detail || "";
        const hasFollowUp = agentVars.follow_up_needed === "yes" && followUp && followUp !== "no action needed";

        let decisionType = "NORMAL";
        if (agentVars.call_outcome === "emergency" || interpretation.toLowerCase().includes("chest")) {
          decisionType = "ESCALATION";
        } else if (interpretation.toLowerCase().includes("dizziness") || hasFollowUp) {
          decisionType = "FAMILY_NOTIFICATION";
        } else if (interpretation.toLowerCase().includes("knee") || durationSeconds < 40) {
          decisionType = "MONITOR";
        }

        decisionCard = {
          id: `dec-${item.attempt_id}`,
          profileId: `profile-${parentName.toLowerCase().replace(/\s+/g, "-")}`,
          parentName,
          timestamp: item.start_datetime
            ? new Date(item.start_datetime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Recent",
          observation,
          interpretation,
          recommendedAction: hasFollowUp ? followUp : "Continue scheduled daily care check-in.",
          actionType: hasFollowUp ? "remind" : "check",
          uncertainty: "Recorded in Anyash longitudinal care memory.",
          urgency: decisionType === "ESCALATION" ? "urgent" : decisionType === "FAMILY_NOTIFICATION" ? "medium" : "low",
          decision: decisionType as any,
          why: agentVars.call_summary || "Call completed without severe acute distress.",
          nextAction: hasFollowUp ? followUp : "Follow up tomorrow morning.",
          nextFollowUpDate: "Tomorrow",
          familyNotification: {
            sent: decisionType !== "NORMAL",
            recipient: agentVars.child_name || "Family",
            channel: "WhatsApp",
            note: hasFollowUp ? `Dispatched update to family: ${followUp}` : "Daily summary logged.",
          },
          actionCompleted: false,
        };
      }

      const dateObj = item.start_datetime
        ? new Date(item.start_datetime)
        : item.attempted_at
        ? new Date(item.attempted_at)
        : new Date();

      const formattedTimestamp =
        dateObj.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        }) +
        ", " +
        dateObj.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

      const dateOnly = dateObj.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });

      realCalls.push({
        attemptId: item.attempt_id,
        interactionId: item.interaction_id !== "NO_INTERACTION_ID" ? item.interaction_id : undefined,
        userIdentifier: item.user_identifier || item.user_contact_hashed,
        profileId: `profile-${parentName.toLowerCase().replace(/\s+/g, "-")}`,
        parentName,
        timestamp: formattedTimestamp,
        dateOnly,
        status: isConnected ? "connected" : item.connectivity_status === "failed" ? "failed" : "no_answer",
        durationSeconds,
        summary: agentVars.call_summary || (isConnected ? "Check-in call connected" : "Call attempt"),
        decisionCard,
        transcript: transcriptTurns.length > 0 ? transcriptTurns : undefined,
        failureReason: item.failure_reason !== "NO_FAILURE_REASON" ? item.failure_reason : undefined,
        audioUrl: item.audio_url || undefined,
        usageCostInr: costs.usageCostInr,
        telephonyCostInr: costs.telephonyCostInr,
        averageLatencyMs: item.average_agent_response_time_in_seconds ? Math.round(item.average_agent_response_time_in_seconds * 1000) : 480,
        numMessages: item.num_messages || transcriptTurns.length,
        number_of_calls:
          agentVars.number_of_calls !== undefined
            ? agentVars.number_of_calls
            : agentVars.is_first_call === true || agentVars.is_first_call === "true"
              ? 1
              : 2,
        rawAgentVariables: agentVars,
      });

      if (parentName && !discoveredParents.has(parentName)) {
        discoveredParents.set(parentName, {
          parentName,
          honorific: agentVars.honorific || "Ji",
          childName: agentVars.child_name || "Family",
          parentPhone: item.user_contact || "+918210611923",
          lastCallText: formattedTimestamp,
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: realCalls.length,
      calls: realCalls,
      discoveredParents: Array.from(discoveredParents.values()),
    });
  } catch (err: any) {
    console.error("Sync calls error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
