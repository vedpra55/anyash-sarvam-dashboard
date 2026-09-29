import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getSarvamAttempts, attemptIdOf } from "@/lib/sarvam";
import { testReason, attemptTime, last10 } from "@/lib/trial";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Parent profiles (for phone matching) and Sarvam attempts load in parallel.
    const supabase = getServiceSupabase();
    const [parentsResult, attempts] = await Promise.all([
      Promise.resolve(supabase.from("parent_profiles").select("id, parent_name, phone_number, child_name")).catch(
        (dbErr) => {
          console.warn("Could not query parent profiles for phone matching:", dbErr);
          return { data: null };
        }
      ),
      getSarvamAttempts(),
    ]);

    if (!attempts.ok) {
      return NextResponse.json({ error: attempts.error }, { status: attempts.status });
    }

    let phoneToParentMap = new Map<string, { id: string; name: string; child_name?: string }>();
    {
      const parents = parentsResult.data;
      if (parents) {
        for (const p of parents) {
          const raw = (p.phone_number || "").replace(/[^0-9+]/g, "");
          if (raw) {
            phoneToParentMap.set(raw, { id: p.id, name: p.parent_name, child_name: p.child_name });
            if (raw.startsWith("+91")) {
              phoneToParentMap.set(raw.slice(3), { id: p.id, name: p.parent_name, child_name: p.child_name });
            }
          }
        }
      }
    }

    // Real trial calls only (the shared rule in lib/trial.ts). Calls to numbers that
    // aren't a parent are only excluded when the parent list actually loaded.
    const parentNumbers = parentsResult.data
      ? new Set<string>(parentsResult.data.map((p: any) => last10(p.phone_number)).filter(Boolean))
      : undefined;
    const phoneCalls = attempts.items
      .filter((item: any) => testReason(item, parentNumbers) === null)
      .sort((a: any, b: any) => attemptTime(b) - attemptTime(a));

    // Normalize into clean CallItem structure
    const calls = phoneCalls.map((item: any) => {
      const agentVars = item.agent_variables || {};
      const userPhone = item.user_contact || item.user_contact_masked || "";
      const cleanPhone = userPhone.replace(/[^0-9+]/g, "");

      // Check matched parent profile from Supabase
      const matchedProfile = cleanPhone
        ? phoneToParentMap.get(cleanPhone) ||
          (cleanPhone.startsWith("+91") ? phoneToParentMap.get(cleanPhone.slice(3)) : undefined)
        : undefined;

      const parentName =
        agentVars.parent_name ||
        matchedProfile?.name ||
        (cleanPhone ? `Parent (${cleanPhone.slice(-4)})` : "Parent");

      const childName = agentVars.child_name || matchedProfile?.child_name || "Family";

      const t = attemptTime(item);
      const createdAt = new Date(isNaN(t) ? Date.now() : t).toISOString();

      return {
        id: attemptIdOf(item),
        attempt_id: attemptIdOf(item),
        interaction_id: item.interaction_id !== "NO_INTERACTION_ID" ? item.interaction_id : undefined,
        parent_name: parentName,
        parent_phone: userPhone,
        child_name: childName,
        call_status: item.connectivity_status || "unknown",
        duration_seconds: Math.round(item.duration_in_seconds || 0),
        call_outcome: agentVars.call_outcome || undefined,
        call_summary: agentVars.call_summary || undefined,
        health_update: agentVars.health_update || undefined,
        follow_up_detail: agentVars.follow_up_detail || undefined,
        follow_up_needed: agentVars.follow_up_needed || undefined,
        parent_mood: agentVars.parent_mood || undefined,
        mood_note: agentVars.mood_note || undefined,
        conversation_signal: agentVars.conversation_signal || undefined,
        ongoing_health_context: agentVars.ongoing_health_context || undefined,
        personal_context: agentVars.personal_context || undefined,
        agent_variables: agentVars,
        created_at: createdAt,
        language_name: item.language_name !== "UNKNOWN" ? item.language_name : undefined,
        num_messages: item.num_messages || 0,
        has_recording: item.interaction_id && item.interaction_id !== "NO_INTERACTION_ID" && (item.duration_in_seconds || 0) > 0,
        audio_url: item.audio_url || undefined,
        end_reason: item.end_reason && item.end_reason !== "NO_END_REASON" ? item.end_reason : undefined,
        goal_status: item.evaluation?.overall_status || undefined,
      };
    });

    // Attach the AI review verdict stored in Supabase for each call
    const reviewByAttempt = new Map<string, any>();
    const attemptIds = calls.map((c) => c.attempt_id).filter(Boolean);
    if (attemptIds.length > 0) {
      try {
        const { data: reviews } = await supabase
          .from("call_records")
          .select("attempt_id, ai_decision, ai_urgency")
          .in("attempt_id", attemptIds);
        for (const r of reviews || []) reviewByAttempt.set(r.attempt_id, r);
      } catch (reviewErr) {
        console.warn("Could not load call reviews:", reviewErr);
      }
    }

    const callsWithReviews = calls.map((c) => {
      const review = reviewByAttempt.get(c.attempt_id);
      return {
        ...c,
        ai_decision: review?.ai_decision || undefined,
        ai_urgency: review?.ai_urgency || undefined,
      };
    });

    return NextResponse.json({
      success: true,
      calls: callsWithReviews,
      total: callsWithReviews.length,
    });
  } catch (err: any) {
    console.error("Failed to fetch Sarvam calls:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch calls" },
      { status: 500 }
    );
  }
}
