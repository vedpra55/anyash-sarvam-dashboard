import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Supabase-side detail for one Sarvam call: the AI assessment and memory
 * change stored in call_records, its decision card, and that day's health log.
 */
export async function GET(req: NextRequest) {
  const attemptId = new URL(req.url).searchParams.get("attempt_id");
  if (!attemptId) {
    return NextResponse.json({ error: "attempt_id is required" }, { status: 400 });
  }

  try {
    const supabase = getServiceSupabase();

    const { data: record, error } = await supabase
      .from("call_records")
      .select(
        "id, attempt_id, parent_id, created_at, call_outcome, ai_processed, ai_model, ai_decision, ai_urgency, ai_action_type, ai_observation, ai_interpretation, ai_recommended_action, ai_uncertainty, ai_family_notification, previous_user_context, resulting_user_context"
      )
      .eq("attempt_id", attemptId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!record) {
      return NextResponse.json({ record: null, decisionCard: null, dailyLog: null });
    }

    // Decision card, the log written for this call, and that parent's log for the
    // call's day all load in parallel; the linked log wins over the day's log.
    const logDate = record.created_at ? new Date(record.created_at).toISOString().split("T")[0] : null;
    const [{ data: decisionCard }, { data: linkedLog }, { data: dayLog }] = await Promise.all([
      supabase
        .from("decision_cards")
        .select("decision, urgency, why, next_action, next_follow_up_date, action_completed")
        .eq("attempt_id", attemptId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("daily_health_logs").select("*").eq("call_id", record.id).maybeSingle(),
      record.parent_id && logDate
        ? supabase
            .from("daily_health_logs")
            .select("*")
            .eq("parent_id", record.parent_id)
            .eq("log_date", logDate)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const dailyLog = linkedLog || dayLog || null;

    return NextResponse.json({ record, decisionCard: decisionCard || null, dailyLog });
  } catch (err: any) {
    console.error("Call details error:", err);
    return NextResponse.json({ error: err.message || "Failed to load call details" }, { status: 500 });
  }
}
