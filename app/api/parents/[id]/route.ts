import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parentId = params.id;
    if (!parentId) {
      return NextResponse.json({ error: "Parent ID is required" }, { status: 400 });
    }

    const body = await req.json();
    const supabase = getServiceSupabase();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.parent_name) updatePayload.parent_name = body.parent_name;
    if (body.phone_number) updatePayload.phone_number = body.phone_number;
    if (body.honorific) updatePayload.honorific = body.honorific;
    if (body.child_name) updatePayload.child_name = body.child_name;
    if (body.routines) updatePayload.routines = body.routines;
    if (body.medical_baseline) updatePayload.medical_baseline = body.medical_baseline;
    if (body.facts) updatePayload.facts = body.facts;
    if (body.current_user_context) updatePayload.current_user_context = body.current_user_context;

    // Handle convenient text fields
    if (body.routines_text) {
      updatePayload.routines = [
        { time: "Daily Routine", activity: body.routines_text },
      ];
    }

    if (body.baseline_text) {
      const conditions = body.baseline_text
        .split(/[,;\n]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      updatePayload.medical_baseline = {
        conditions,
      };
    }

    // Keep initial 2-line working memory in sync with updated parent/child names
    if (!body.current_user_context && (body.parent_name || body.child_name || body.facts?.relationship)) {
      const { data: current } = await supabase
        .from("parent_profiles")
        .select("parent_name, child_name, facts, current_user_context, number_of_calls")
        .eq("id", parentId)
        .maybeSingle();

      if (current && (!current.current_user_context || current.current_user_context.includes("TODAY: Initial"))) {
        const pName = body.parent_name || current.parent_name || "Parent";
        const cName = body.child_name || current.child_name || current.facts?.family_member || "Family";
        const rel = body.facts?.relationship || current.facts?.relationship || "Child";
        updatePayload.current_user_context = `TODAY: Initial Profile Created | CALL COUNT: ${current.number_of_calls || 1}\nBASELINE: ${pName} | Child: ${cName} (${rel})`;
      }
    }

    const { data: updatedParent, error: updateErr } = await supabase
      .from("parent_profiles")
      .update(updatePayload)
      .eq("id", parentId)
      .select()
      .single();

    if (updateErr) {
      console.error("Failed to update parent profile:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, parent: updatedParent });
  } catch (err: any) {
    console.error("Update parent failed:", err);
    return NextResponse.json({ error: err.message || "Failed to update parent" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parentId = params.id;
    if (!parentId) {
      return NextResponse.json({ error: "Parent ID is required" }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Clean up associated records first
    await supabase.from("daily_health_logs").delete().eq("parent_id", parentId);
    await supabase.from("call_records").delete().eq("parent_id", parentId);
    await supabase.from("decision_cards").delete().eq("profile_id", parentId);

    const { error: deleteErr } = await supabase
      .from("parent_profiles")
      .delete()
      .eq("id", parentId);

    if (deleteErr) {
      console.error("Failed to delete parent_profile:", deleteErr);
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete parent" }, { status: 500 });
  }
}
