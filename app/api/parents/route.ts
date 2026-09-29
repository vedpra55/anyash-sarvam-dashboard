import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchSarvamCalls, linkCallsToParents } from "@/lib/sarvam";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    // 1. Fetch all parent profiles from Supabase
    const { data: parents, error: parentsErr } = await supabase
      .from("parent_profiles")
      .select("*")
      .order("updated_at", { ascending: false });

    if (parentsErr) {
      console.error("Error fetching parent profiles:", parentsErr);
      return NextResponse.json({ error: parentsErr.message }, { status: 500 });
    }

    if (!parents || parents.length === 0) {
      return NextResponse.json({ parents: [] });
    }

    // 2. Fetch live calls directly from Sarvam AI Analytics
    const sarvamCalls = await fetchSarvamCalls({ daysBack: 90, limit: 100 });

    // 3. Fetch latest daily logs for each parent from Supabase
    const parentIds = parents.map((p) => p.id);
    const { data: dailyLogs } = await supabase
      .from("daily_health_logs")
      .select("*")
      .in("parent_id", parentIds)
      .order("log_date", { ascending: false });

    // 4. Link Sarvam calls and daily logs to each parent
    const parentsWithCalls = linkCallsToParents(parents, sarvamCalls);

    const enrichedParents = parentsWithCalls.map((parent) => {
      const parentLogs = (dailyLogs || []).filter((l) => l.parent_id === parent.id);
      const latestLog = parentLogs[0] || null;

      return {
        ...parent,
        latestLog,
        dailyLogs: parentLogs.slice(0, 10),
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

    // Parse routines if provided as text or list
    const routines = routines_text
      ? [{ time: "Daily Routine", activity: routines_text }]
      : [
          { time: "06:30 AM", activity: "Morning terrace walk" },
          { time: "08:30 AM", activity: "Breakfast and morning medication" },
          { time: "02:00 PM", activity: "Afternoon rest" },
        ];

    const conditions = baseline_text
      ? baseline_text.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean)
      : ["General elder wellness"];

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
