import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchSarvamCalls, linkCallsToParents } from "@/lib/sarvam";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      parent_name,
      honorific,
      phone_number,
      preferred_language,
      child_name,
      relationship,
      routines_text,
      baseline_text,
    } = body;

    if (!parent_name || !phone_number) {
      return NextResponse.json(
        { error: "Parent name and phone number are required" },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();
    const cleanPhone = phone_number.replace(/[^\d+]/g, "");
    const last10 = cleanPhone.slice(-10);

    // Structured lists from the form; free-text fields are still accepted.
    const cleanList = (value: unknown): string[] =>
      Array.isArray(value) ? value.map((s) => String(s).trim()).filter(Boolean) : [];

    const routines = Array.isArray(body.routines)
      ? body.routines
          .map((r: any) => ({ time: String(r.time || "").trim(), activity: String(r.activity || "").trim() }))
          .filter((r: any) => r.activity)
      : routines_text
      ? [{ time: "Daily Routine", activity: routines_text }]
      : [];

    const conditions = Array.isArray(body.conditions)
      ? cleanList(body.conditions)
      : baseline_text
      ? baseline_text.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean)
      : [];
    const medications = cleanList(body.medications);

    const effectiveChild = child_name || "Family";
    const effectiveRel = relationship || "Child";
    const newContext = `TODAY: Initial Profile Created | CALL COUNT: 1\nBASELINE: ${parent_name} | Child: ${effectiveChild} (${effectiveRel})`;

    // Check if a parent with this phone already exists to prevent duplicate rows
    const { data: existing } = await supabase
      .from("parent_profiles")
      .select("id, current_user_context, number_of_calls")
      .or(`phone_number.eq.${cleanPhone},phone_number.ilike.%${last10}%`)
      .maybeSingle();

    if (existing) {
      const existingContext = existing.current_user_context || "";
      let updatedContext = existingContext;
      if (!existingContext || existingContext.includes("TODAY: Initial")) {
        updatedContext = `TODAY: Initial Profile Created | CALL COUNT: ${existing.number_of_calls || 1}\nBASELINE: ${parent_name} | Child: ${effectiveChild} (${effectiveRel})`;
      }

      const { data: updatedParent, error: updateErr } = await supabase
        .from("parent_profiles")
        .update({
          parent_name,
          honorific: honorific || "Mummy Ji",
          phone_number: cleanPhone,
          child_name: effectiveChild,
          current_user_context: updatedContext,
          facts: {
            relationship: effectiveRel,
            language: preferred_language || "Hindi",
            family_member: effectiveChild,
          },
          routines,
          medical_baseline: {
            conditions,
            medications,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) {
        console.error("Failed to update existing parent profile:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, parent: updatedParent }, { status: 200 });
    }

    const { data: newParent, error: insertErr } = await supabase
      .from("parent_profiles")
      .insert({
        parent_name,
        honorific: honorific || "Mummy Ji",
        phone_number: cleanPhone,
        child_name: child_name || "Family",
        number_of_calls: 1,
        facts: {
          relationship: relationship || "Parent",
          language: preferred_language || "Hindi",
          family_member: child_name || "Family",
        },
        routines,
        medical_baseline: {
          conditions,
          medications,
        },
        current_user_context: newContext,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Failed to insert parent profile:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, parent: newParent }, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create parent profile:", err);
    return NextResponse.json({ error: err.message || "Failed to create parent" }, { status: 500 });
  }
}
