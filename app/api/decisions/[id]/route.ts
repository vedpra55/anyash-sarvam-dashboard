import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Marks a decision card's follow-up as done (or not done). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    if (typeof body.action_completed !== "boolean") {
      return NextResponse.json({ error: "action_completed must be true or false" }, { status: 400 });
    }

    const { data, error } = await getServiceSupabase()
      .from("decision_cards")
      .update({ action_completed: body.action_completed, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .select("id, action_completed")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Decision not found" }, { status: 404 });
    return NextResponse.json({ success: true, decision: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update decision" }, { status: 500 });
  }
}
