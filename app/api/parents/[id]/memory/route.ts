import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Anya's current working memory for a parent, plus how it changed on each
 * processed call (previous -> resulting user_context from call_records).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = getServiceSupabase();

    const [{ data: parent, error }, { data: history }] = await Promise.all([
      supabase
        .from("parent_profiles")
        .select("id, parent_name, current_user_context, number_of_calls, last_call_timestamp, updated_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("call_records")
        .select("attempt_id, interaction_id, created_at, call_outcome, duration_seconds, previous_user_context, resulting_user_context")
        .eq("parent_id", id)
        .not("resulting_user_context", "is", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!parent) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }

    return NextResponse.json({
      memory: parent.current_user_context || "",
      numberOfCalls: parent.number_of_calls,
      lastCallAt: parent.last_call_timestamp,
      updatedAt: parent.updated_at,
      history: history || [],
    });
  } catch (err: any) {
    console.error("Memory route error:", err);
    return NextResponse.json({ error: err.message || "Failed to load memory" }, { status: 500 });
  }
}
