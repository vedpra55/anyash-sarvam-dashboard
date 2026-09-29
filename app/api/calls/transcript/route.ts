import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const interactionId = searchParams.get("interaction_id");
    const attemptId = searchParams.get("attempt_id");

    if ((!interactionId || interactionId === "NO_INTERACTION_ID") && !attemptId) {
      return NextResponse.json({
        success: true,
        interaction_id: null,
        attempt_id: null,
        messages: [],
        transcript: [],
      });
    }

    const apiKey = process.env.SARVAM_API_KEY || "";
    const orgId = process.env.SARVAM_ORG_ID || "";
    const workspaceId = process.env.SARVAM_WORKSPACE_ID || "";
    const appId = process.env.SARVAM_APP_ID || "";

    // 1. First attempt: Query Sarvam Live Analytics API if interactionId exists
    if (apiKey && orgId && workspaceId && appId && interactionId && interactionId !== "NO_INTERACTION_ID") {
      try {
        const transcriptUrl = `https://apps.sarvam.ai/api/analytics/v1/${orgId}/${workspaceId}/${appId}/transcripts/${encodeURIComponent(
          interactionId
        )}`;

        const sarvamRes = await fetch(transcriptUrl, {
          method: "GET",
          headers: {
            "X-API-Key": apiKey.trim(),
            "API-Subscription-Key": apiKey.trim(),
          },
          cache: "no-store",
        });

        if (sarvamRes.ok) {
          const data = await sarvamRes.json();
          const rawMessages = data.messages || [];

          if (Array.isArray(rawMessages) && rawMessages.length > 0) {
            const messages = rawMessages.map((m: any, idx: number) => ({
              turn_id: m.turn_id || idx + 1,
              role: m.role === "assistant" || m.role === "agent" ? "agent" : "user",
              content: m.content || m.text || "",
              text: m.content || m.text || "",
              language_name: m.language_name !== "UNKNOWN" ? m.language_name : undefined,
            }));

            return NextResponse.json({
              success: true,
              interaction_id: interactionId,
              attempt_id: attemptId || null,
              messages,
              transcript: messages,
            });
          }
        }
      } catch (sarvamErr) {
        console.warn("Failed fetching from Sarvam transcript API, trying Supabase fallback:", sarvamErr);
      }
    }

    // 2. Second attempt: Check Supabase `call_records` table by interaction_id or attempt_id
    try {
      const supabase = getServiceSupabase();
      let query = supabase.from("call_records").select("transcript, interaction_id, attempt_id");

      if (interactionId && interactionId !== "NO_INTERACTION_ID") {
        query = query.eq("interaction_id", interactionId);
      } else if (attemptId) {
        query = query.eq("attempt_id", attemptId);
      }

      const { data: record } = await query.maybeSingle();

      if (record && Array.isArray(record.transcript) && record.transcript.length > 0) {
        const messages = record.transcript.map((m: any, idx: number) => ({
          turn_id: m.turn_id || idx + 1,
          role: m.role === "assistant" || m.role === "agent" ? "agent" : "user",
          content: m.text || m.content || "",
          text: m.text || m.content || "",
          language_name: m.language_name,
        }));

        return NextResponse.json({
          success: true,
          interaction_id: interactionId || record.interaction_id || null,
          attempt_id: attemptId || record.attempt_id || null,
          messages,
          transcript: messages,
        });
      }
    } catch (dbErr) {
      console.warn("Supabase fallback query error:", dbErr);
    }

    // 3. If neither source has transcripts yet
    return NextResponse.json({
      success: true,
      interaction_id: interactionId || null,
      attempt_id: attemptId || null,
      messages: [],
      transcript: [],
    });
  } catch (err: any) {
    console.error("Transcript route error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load transcript" },
      { status: 500 }
    );
  }
}
