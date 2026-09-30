import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

/**
 * Sarvam's call-attempt webhook. It only records call status and duration on
 * the call_records row for this attempt.
 *
 * The sarvam-call-handler edge function (Sarvam's on_end tool) is the only
 * writer of memory, call counts, daily logs and decision cards.
 */

interface SarvamWebhookPayload {
  attempt_id?: string;
  /** Older payload shape. */
  status?: string;
  connectivity_status?: string | null;
  completion_status?: string | null;
  duration?: number | null;
  interaction_id?: string | null;
  failure_reason?: string | null;
  recording_url?: string | null;
  metadata?: Record<string, any> | null;
  webhook_config?: { metadata?: Record<string, any> | null } | null;
}

export async function POST(req: NextRequest) {
  let payload: SarvamWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const attemptId = payload.attempt_id;
  const status = payload.connectivity_status || payload.status || "unknown";
  const duration = Number(payload.duration) > 0 ? Math.round(Number(payload.duration)) : null;
  const metadata = payload.metadata || payload.webhook_config?.metadata || {};
  const parentId: string | null = metadata.user_id || metadata.profile_id || null;
  console.log(`Sarvam webhook: attempt ${attemptId} status ${status} duration ${duration ?? "none"}s`);

  if (!attemptId) {
    console.warn("Sarvam webhook without attempt_id; ignored");
    return NextResponse.json({ received: true, updated: false });
  }

  try {
    const supabase = getServiceSupabase();
    const { data: existing, error: readErr } = await supabase
      .from("call_records")
      .select("id, duration_seconds, interaction_id, audio_url")
      .eq("attempt_id", attemptId)
      .maybeSingle();
    if (readErr) throw readErr;

    if (existing) {
      // The edge function has already classified the call; only fill gaps.
      const patch: Record<string, any> = {};
      if (duration && !(Number(existing.duration_seconds) > 0)) patch.duration_seconds = duration;
      if (payload.interaction_id && !existing.interaction_id) patch.interaction_id = payload.interaction_id;
      if (payload.recording_url && !existing.audio_url) patch.audio_url = payload.recording_url;
      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        const { error } = await supabase.from("call_records").update(patch).eq("id", existing.id);
        if (error) throw error;
      }
      return NextResponse.json({ received: true, updated: Object.keys(patch).length > 0 });
    }

    // No row yet: the call was not answered, or the edge function has not run.
    // Create a minimal row it will complete by attempt_id.
    const { data: parent } = parentId
      ? await supabase
          .from("parent_profiles")
          .select("id, parent_name, child_name, phone_number")
          .eq("id", parentId)
          .maybeSingle()
      : { data: null };

    if (!parent) {
      console.warn(`Sarvam webhook: no parent matches attempt ${attemptId} (user_id ${parentId}); nothing saved`);
      return NextResponse.json({ received: true, updated: false });
    }

    const { error: insertErr } = await supabase.from("call_records").upsert(
      {
        attempt_id: attemptId,
        interaction_id: payload.interaction_id || null,
        parent_id: parent.id,
        parent_name: parent.parent_name,
        child_name: parent.child_name,
        parent_phone: parent.phone_number,
        call_status: status,
        duration_seconds: duration ?? 0,
        audio_url: payload.recording_url || null,
        failure_reason: payload.failure_reason || null,
        metadata: { source: "webhook", completion_status: payload.completion_status || null },
      },
      { onConflict: "attempt_id", ignoreDuplicates: true },
    );
    if (insertErr) throw insertErr;
    return NextResponse.json({ received: true, updated: true });
  } catch (err: any) {
    console.error("Error processing Sarvam webhook:", err);
    return NextResponse.json({ error: err?.message || "Webhook processing error" }, { status: 500 });
  }
}
