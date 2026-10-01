import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchSarvamCalls, linkCallsToParents } from "@/lib/sarvam";
import { validateOnboarding } from "@/lib/onboarding";
import { saveOnboardingProfile, ProfileSaveError } from "@/lib/parentStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    // 1. Parent profiles (Supabase) and live calls (Sarvam) load in parallel.
    const [{ data: parents, error: parentsErr }, sarvamCalls] = await Promise.all([
      supabase.from("parent_profiles").select("*").order("updated_at", { ascending: false }),
      fetchSarvamCalls({ limit: 100 }),
    ]);

    if (parentsErr) {
      console.error("Error fetching parent profiles:", parentsErr);
      return NextResponse.json({ error: parentsErr.message }, { status: 500 });
    }

    if (!parents || parents.length === 0) {
      return NextResponse.json({ parents: [] });
    }

    // 2. Daily logs (last 14 days) and AI reviews of recent calls, in parallel.
    const parentIds = parents.map((p) => p.id);
    const since = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];
    const [{ data: dailyLogs }, { data: records }] = await Promise.all([
      supabase
        .from("daily_health_logs")
        .select("*")
        .in("parent_id", parentIds)
        .gte("log_date", since)
        .order("log_date", { ascending: false }),
      supabase
        .from("call_records")
        .select(
          "attempt_id, parent_id, created_at, call_outcome, follow_up_needed, follow_up_detail, ai_decision, ai_urgency, ai_observation, ai_recommended_action"
        )
        .in("parent_id", parentIds)
        .eq("ai_processed", true)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    // 3. Decision cards for those reviews.
    const attemptIds = (records || []).map((r) => r.attempt_id);
    const { data: cards } = attemptIds.length
      ? await supabase
          .from("decision_cards")
          .select("id, attempt_id, next_action, next_follow_up_date, action_completed, created_at")
          .in("attempt_id", attemptIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[] };

    const cardByAttempt = new Map<string, any>();
    for (const card of cards || []) {
      if (!cardByAttempt.has(card.attempt_id)) cardByAttempt.set(card.attempt_id, card);
    }

    // 5. Link Sarvam calls, daily logs and reviews to each parent
    const parentsWithCalls = linkCallsToParents(parents, sarvamCalls);

    const enrichedParents = parentsWithCalls.map((parent) => {
      const parentLogs = (dailyLogs || []).filter((l) => l.parent_id === parent.id);
      const latestLog = parentLogs[0] || null;
      const reviews = (records || [])
        .filter((r) => r.parent_id === parent.id)
        .slice(0, 10)
        .map((r) => {
          const card = cardByAttempt.get(r.attempt_id);
          return {
            ...r,
            card_id: card?.id || null,
            next_action: card?.next_action || null,
            next_follow_up_date: card?.next_follow_up_date || null,
            action_completed: Boolean(card?.action_completed),
          };
        });

      return {
        ...parent,
        latestLog,
        dailyLogs: parentLogs.slice(0, 14),
        reviews,
      };
    });

    return NextResponse.json({ parents: enrichedParents });
  } catch (err: any) {
    console.error("Failed to load parents:", err);
    return NextResponse.json({ error: err.message || "Failed to load parents" }, { status: 500 });
  }
}

/** Add a parent from the onboarding form (see lib/onboarding.ts). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Older callers sent preferred_language / medications.
    const valid = validateOnboarding({
      ...body,
      language: body.language || body.preferred_language,
      medicines: body.medicines || body.medications,
    });
    if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });

    const { parent, created } = await saveOnboardingProfile(valid.input, { kind: "create" });
    return NextResponse.json({ success: true, parent }, { status: created ? 201 : 200 });
  } catch (err: any) {
    const status = err instanceof ProfileSaveError ? err.status : 500;
    console.error("Failed to create parent profile:", err);
    return NextResponse.json({ error: err.message || "Failed to create parent" }, { status });
  }
}
