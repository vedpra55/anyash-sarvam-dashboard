import { NextRequest, NextResponse } from "next/server";
import { CallStatus, CallTranscriptTurn, DecisionCard, ActionType, UrgencyLevel } from "@/lib/types";
import { getServiceSupabase } from "@/lib/supabase";

interface SarvamWebhookPayload {
  attempt_id: string;
  status: "connected" | "no_answer" | "busy" | "failed";
  channel_info?: {
    channel_type: string;
    channel_provider: string;
    agent_phone_number: string;
  };
  duration?: number | null;
  interaction_id?: string | null;
  failure_reason?: string | null;
  final_agent_variables?: Record<string, any> | null;
  webhook_config?: {
    url: string;
    metadata?: {
      profile_id?: string;
      child_name?: string;
      user_id?: string;
      number_of_calls?: string;
    } | null;
  } | null;
  interaction_transcript?: Array<{
    role: "agent" | "user";
    en_text?: string;
    text?: string;
  }> | null;
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as SarvamWebhookPayload;
    console.log("Received Sarvam call webhook:", payload.attempt_id, payload.status);

    const profileId =
      payload.webhook_config?.metadata?.profile_id || "profile-mom-sunita";
    const status: CallStatus = payload.status || "connected";
    const duration = payload.duration || 0;
    const isSuccessfulCall = status === "connected" || duration > 5;

    const transcript: CallTranscriptTurn[] = (payload.interaction_transcript || []).map(
      (t) => ({
        role: t.role,
        text: t.en_text || t.text || "",
      })
    );

    let decisionCard: DecisionCard | undefined = undefined;

    if (status === "connected" && transcript.length > 0) {
      const fullText = transcript.map((t) => t.text).join(" ").toLowerCase();

      let observation = "Parent had a standard check-in call with Anya.";
      let interpretation = "Conversation was pleasant, no acute health changes noticed.";
      let recommendedAction = "Continue regular daily check-in schedule.";
      let actionType: ActionType = "check";
      let uncertainty = "Confirm if evening medicine was taken as planned.";
      let urgency: UrgencyLevel = "low";

      if (
        fullText.includes("chest") ||
        fullText.includes("breathless") ||
        fullText.includes("heart") ||
        fullText.includes("dizziness")
      ) {
        observation = "Parent mentioned chest discomfort or shortness of breath.";
        interpretation = "Potentially critical cardiovascular or respiratory signal.";
        recommendedAction = "Immediately call parent and coordinate with emergency physician.";
        actionType = "escalate";
        uncertainty = "Need immediate in-person vitals check.";
        urgency = "urgent";
      } else if (
        fullText.includes("knee") ||
        fullText.includes("stiff") ||
        fullText.includes("joint") ||
        fullText.includes("stairs")
      ) {
        observation = "Parent reported knee stiffness while climbing stairs.";
        interpretation = "Recurring joint pain signal. Likely osteoarthritis discomfort.";
        recommendedAction = "Ask about knee pain during evening call; consider ordering knee support compression band.";
        actionType = "ask";
        uncertainty = "Check if pain is better after rest or requires physiotherapy.";
        urgency = "medium";
      }

      decisionCard = {
        id: `dec-${Date.now()}`,
        profileId,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        observation,
        interpretation,
        recommendedAction,
        actionType,
        uncertainty,
        urgency,
        actionCompleted: false,
      };
    }

    // Persist and increment call number by 1 after each SUCCESSFUL call
    try {
      const supabase = getServiceSupabase();
      const userId = payload.webhook_config?.metadata?.user_id;
      const callerNumber = payload.channel_info?.agent_phone_number || "";

      let targetParent: any = null;
      if (userId) {
        const { data: p } = await supabase
          .from("parent_profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        targetParent = p;
      }

      if (!targetParent && callerNumber) {
        const last10 = callerNumber.replace(/\D/g, "").slice(-10);
        const { data: p } = await supabase
          .from("parent_profiles")
          .select("*")
          .ilike("phone_number", `%${last10}%`)
          .maybeSingle();
        targetParent = p;
      }

      if (targetParent) {
        const rawCallNum =
          payload.final_agent_variables?.number_of_calls ||
          payload.webhook_config?.metadata?.number_of_calls ||
          targetParent.number_of_calls ||
          1;
        const currentCallNum = Number(rawCallNum) || 1;

        // If call was successful, increment by 1; otherwise keep current
        const nextCallCount = isSuccessfulCall ? currentCallNum + 1 : currentCallNum;

        let updatedContext = targetParent.current_user_context || "";
        if (updatedContext && /CALL COUNT:\s*\d+/i.test(updatedContext)) {
          updatedContext = updatedContext.replace(/CALL COUNT:\s*\d+/i, `CALL COUNT: ${nextCallCount}`);
        }

        await supabase
          .from("parent_profiles")
          .update({
            number_of_calls: nextCallCount,
            current_user_context: updatedContext,
            last_call_timestamp: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetParent.id);

        console.log(`Updated parent ${targetParent.id}: number_of_calls was ${currentCallNum} -> now ${nextCallCount}`);
      }
    } catch (dbErr) {
      console.error("Failed to update parent_profiles in webhook:", dbErr);
    }

    return NextResponse.json({
      received: true,
      attemptId: payload.attempt_id,
      status,
      duration,
      decisionCard,
    });
  } catch (err: any) {
    console.error("Error processing Sarvam webhook:", err);
    return NextResponse.json(
      { error: err?.message || "Webhook processing error" },
      { status: 500 }
    );
  }
}
