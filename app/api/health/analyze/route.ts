import { NextRequest, NextResponse } from "next/server";
import { DecisionCard, ActionType, UrgencyLevel, CallTranscriptTurn } from "@/lib/types";

interface AnalyzeRequestBody {
  transcript: CallTranscriptTurn[];
  profileId: string;
  parentName?: string;
  childName?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, profileId, parentName = "Parent", childName = "Child" } =
      (await req.json()) as AnalyzeRequestBody;

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: "Transcript is required for analysis" },
        { status: 400 }
      );
    }

    const fullText = transcript.map((t) => t.text).join(" ").toLowerCase();

    // Health reasoning heuristics based on the Voice Health Companion spec
    let observation = `${parentName} had a standard check-in call and reported feeling okay overall.`;
    let interpretation = "No acute changes or recurring pain signals were reported during today's call.";
    let recommendedAction = `Keep up with the regular check-in schedule tomorrow.`;
    let actionType: ActionType = "check";
    let uncertainty = "Verify if medicine routine was followed later in the evening.";
    let urgency: UrgencyLevel = "low";

    // Emergency / Chest Pain / Breathlessness (Urgent)
    if (
      fullText.includes("chest") ||
      fullText.includes("seene mein") ||
      fullText.includes("breathless") ||
      fullText.includes("saans") ||
      fullText.includes("chhati")
    ) {
      observation = `${parentName} mentioned tightness or discomfort in the chest/breathing.`;
      interpretation = "Potentially critical emergency signal. Requires immediate family and medical response.";
      recommendedAction = `Trigger family emergency plan immediately. Call ${parentName} and emergency doctor without waiting.`;
      actionType = "escalate";
      uncertainty = "Need immediate in-person confirmation of blood pressure and vitals.";
      urgency = "urgent";
    }
    // Joint / Knee pain (Recurring signal)
    else if (
      fullText.includes("knee") ||
      fullText.includes("ghutna") ||
      fullText.includes("joint") ||
      fullText.includes("stiff") ||
      fullText.includes("seedhi") ||
      fullText.includes("stairs")
    ) {
      observation = `${parentName} reported knee stiffness and mild pain while climbing stairs.`;
      interpretation = "Recurring joint pain signal (observed in recent check-ins). Likely osteoarthritis flare-up.";
      recommendedAction = `Ask ${parentName} about pain severity tonight; consider ordering a supportive knee brace or joint gel on Blinkit.`;
      actionType = "buy";
      uncertainty = "Unclear whether pain eases with warm compression or persists during sleep.";
      urgency = "medium";
    }
    // Sleep / Caffeine / Headache
    else if (
      fullText.includes("sleep") ||
      fullText.includes("neend") ||
      fullText.includes("coffee") ||
      fullText.includes("chai") ||
      fullText.includes("headache") ||
      fullText.includes("sar dard")
    ) {
      observation = `${parentName} reported disturbed sleep and waking up during the night.`;
      interpretation = "Late tea/coffee consumption was mentioned. Caffeine after 7:30 PM is disrupting sleep.";
      recommendedAction = `Gently remind ${parentName} during your evening call to switch to warm milk or herbal tea before bed.`;
      actionType = "remind";
      uncertainty = "Check if room temperature or anxiety about family also contributed to wakefulness.";
      urgency = "low";
    }
    // Missed medicine
    else if (
      fullText.includes("bhool") ||
      fullText.includes("forgot") ||
      fullText.includes("miss") ||
      fullText.includes("dawaai nahi")
    ) {
      observation = `${parentName} indicated they may have delayed or skipped their afternoon medication.`;
      interpretation = "Minor deviation from regular prescription schedule.";
      recommendedAction = `Send a quick WhatsApp reminder to verify that the afternoon dose is taken with a light snack.`;
      actionType = "remind";
      uncertainty = "Confirm whether the medicine strip is running low.";
      urgency = "medium";
    }

    const decisionCard: DecisionCard = {
      id: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

    return NextResponse.json({
      success: true,
      decisionCard,
    });
  } catch (err: any) {
    console.error("Health analysis error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to analyze transcript" },
      { status: 500 }
    );
  }
}
