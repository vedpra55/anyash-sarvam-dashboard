import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getSarvamAttempts, attemptIdOf } from "@/lib/sarvam";
import { attemptTime, last10, testReason } from "@/lib/trial";
import type { StoryCall } from "@/lib/story";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const clean = (v: unknown) => (typeof v === "string" && v.trim() && v !== "UNKNOWN" ? v.trim() : undefined);

/**
 * Everything the Summary and Report tabs need for one parent: every Sarvam call
 * to their number since the trial started (Sarvam is the full record), plus
 * what Supabase adds where it has it: health logs, AI reviews, the parent's
 * own words and open threads. lib/story.ts turns this into days and reports.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = getServiceSupabase();

  const { data: parent, error } = await supabase
    .from("parent_profiles")
    .select("id, parent_name, honorific, phone_number, language, created_at, facts")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!parent) return NextResponse.json({ error: "Parent not found." }, { status: 404 });

  const phone = last10(parent.phone_number);
  const [attempts, logs, records, cards, events, threads] = await Promise.all([
    getSarvamAttempts(),
    supabase
      .from("daily_health_logs")
      .select("log_date, sleep_hours, sleep_quality, appetite, meals_reported, medication_adherence, mobility_and_pain, mood_and_energy, incidents_red_flags")
      .eq("parent_id", id)
      .order("log_date", { ascending: true }),
    supabase
      .from("call_records")
      .select("attempt_id, created_at, ai_decision, ai_observation, ai_recommended_action")
      .eq("parent_id", id)
      .eq("ai_processed", true),
    supabase.from("decision_cards").select("attempt_id, created_at, decision, observation, next_action, recommended_action").eq("profile_id", id),
    supabase
      .from("memory_events")
      .select("call_date, category, parent_words, summary, importance")
      .eq("parent_id", id)
      .order("call_date", { ascending: false })
      .limit(300),
    supabase
      .from("threads")
      .select("title, kind, status, importance, last_words, next_ask_on, last_update")
      .eq("parent_id", id),
  ]);

  // Sarvam: the parent's own real calls. A failed Sarvam request still shows
  // what Supabase has, with a notice.
  const calls: StoryCall[] = attempts.ok
    ? attempts.items
        .filter((item: any) => testReason(item) === null && last10(item.user_contact || item.user_contact_masked) === phone)
        .map((item: any) => {
          const v = item.agent_variables || {};
          const t = attemptTime(item);
          return {
            attempt_id: attemptIdOf(item),
            at: new Date(isNaN(t) ? Date.now() : t).toISOString(),
            status: item.connectivity_status || "unknown",
            seconds: Math.round(item.duration_in_seconds || 0),
            language: clean(item.language_name),
            outcome: clean(v.call_outcome),
            summary: clean(v.call_summary),
            health: clean(v.health_update),
            mood: clean(v.parent_mood),
            moodNote: clean(v.mood_note),
            followUpNeeded: clean(v.follow_up_needed),
            followUpDetail: clean(v.follow_up_detail),
          };
        })
    : [];

  // One review per call: the decision card if there is one, else the AI
  // assessment stored on the call record.
  const cardByAttempt = new Map((cards.data || []).map((c: any) => [c.attempt_id, c]));
  const reviews = (records.data || []).map((r: any) => {
    const c: any = cardByAttempt.get(r.attempt_id);
    return {
      attempt_id: r.attempt_id,
      at: r.created_at,
      decision: c?.decision || r.ai_decision || null,
      observation: c?.observation || r.ai_observation || null,
      action: c?.next_action || c?.recommended_action || r.ai_recommended_action || null,
    };
  });

  const facts: any = parent.facts || {};
  const role = typeof facts.parent_role === "object" ? facts.parent_role?.value : facts.parent_role;

  return NextResponse.json(
    {
      parent: { id: parent.id, name: parent.parent_name, honorific: parent.honorific, language: parent.language, role: role || "" },
      joinedAt: parent.created_at,
      calls,
      logs: logs.data || [],
      reviews,
      events: (events.data || []).map((e: any) => ({
        date: e.call_date,
        category: e.category,
        words: e.parent_words || "",
        summary: e.summary,
        importance: e.importance || 0,
      })),
      threads: threads.data || [],
      sarvamError: attempts.ok ? null : attempts.error,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
