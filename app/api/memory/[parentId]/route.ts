import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { BRIEF_MODE_KEY, parseBriefMode } from "@/lib/briefs";

export const dynamic = "force-dynamic";

/**
 * Everything the progressive memory holds for one parent: pre-call briefs next
 * to the user_context that was actually sent, the living profile (with its
 * history), threads, reflections and the event log.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ parentId: string }> }) {
  const { parentId } = await params;
  try {
    const supabase = getServiceSupabase();
    const [parent, mode, briefs, facts, threads, reflections, events] = await Promise.all([
      supabase
        .from("parent_profiles")
        .select("id, parent_name, honorific, number_of_calls, current_user_context")
        .eq("id", parentId)
        .maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", BRIEF_MODE_KEY).maybeSingle(),
      supabase
        .from("call_briefs")
        .select("id, call_number, brief_text, mode, used_in_call, attempt_id, sent_user_context, checks, created_at")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("profile_facts")
        .select("id, block, key, value, source, confirmed, valid_from, valid_to, created_at")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: true }),
      supabase
        .from("threads")
        .select("id, title, kind, status, importance, opened_on, last_update, last_mentioned_call, next_ask_call, next_ask_on, last_words, closed_reason")
        .eq("parent_id", parentId)
        .order("last_update", { ascending: false }),
      supabase
        .from("reflections")
        .select("id, calls_covered, patterns, created_at")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("memory_events")
        .select("id, call_number, call_date, category, parent_words, summary, importance, created_at")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    for (const r of [parent, briefs, facts, threads, reflections, events]) {
      if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    }
    if (!parent.data) return NextResponse.json({ error: "Parent not found" }, { status: 404 });

    // Briefs are matched with the call they were built for, so the page can
    // show old and new memory next to what happened on that call.
    const attemptIds = (briefs.data || []).map((b) => b.attempt_id).filter(Boolean) as string[];
    const { data: calls } = attemptIds.length
      ? await supabase
          .from("call_records")
          .select("attempt_id, call_status, duration_seconds, call_summary, previous_user_context, created_at")
          .in("attempt_id", attemptIds)
      : { data: [] as any[] };
    const callByAttempt = new Map((calls || []).map((c) => [c.attempt_id, c]));

    return NextResponse.json({
      parent: parent.data,
      mode: parseBriefMode(mode.data?.value),
      briefs: (briefs.data || []).map((b) => ({ ...b, call: b.attempt_id ? callByAttempt.get(b.attempt_id) || null : null })),
      facts: (facts.data || []).filter((f) => f.key !== "child_worry"),
      threads: threads.data || [],
      reflections: reflections.data || [],
      events: events.data || [],
    });
  } catch (err: any) {
    console.error("Memory v2 route error:", err);
    return NextResponse.json({ error: err?.message || "Failed to load memory" }, { status: 500 });
  }
}
