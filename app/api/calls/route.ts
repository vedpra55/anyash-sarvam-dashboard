import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isTestCall(item: any) {
  const contact = item.user_contact || item.user_contact_masked || "";
  const name = (item.agent_variables?.parent_name || "").toLowerCase();
  // Filter dummy numbers (9876543210), web tests (@), or calls labeled "Test"
  if (contact.includes("@")) return true;
  if (contact.includes("9876543210")) return true;
  if (name === "test") return true;
  if (item.is_debug_call === 1) return true;
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.SARVAM_API_KEY || "";
    const orgId = process.env.SARVAM_ORG_ID || "";
    const workspaceId = process.env.SARVAM_WORKSPACE_ID || "";
    const appId = process.env.SARVAM_APP_ID || "";

    if (!apiKey || !orgId || !workspaceId || !appId) {
      return NextResponse.json(
        { error: "Sarvam environment variables not configured" },
        { status: 500 }
      );
    }

    // Load parent profiles from Supabase to match by phone number if needed
    const supabase = getServiceSupabase();
    let phoneToParentMap = new Map<string, { id: string; name: string; child_name?: string }>();
    try {
      const { data: parents } = await supabase.from("parent_profiles").select("id, parent_name, phone_number, child_name");
      if (parents) {
        for (const p of parents) {
          const raw = (p.phone_number || "").replace(/[^0-9+]/g, "");
          if (raw) {
            phoneToParentMap.set(raw, { id: p.id, name: p.parent_name, child_name: p.child_name });
            if (raw.startsWith("+91")) {
              phoneToParentMap.set(raw.slice(3), { id: p.id, name: p.parent_name, child_name: p.child_name });
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn("Could not query parent profiles for phone matching:", dbErr);
    }

    // Strictly fetch only calls on or after 25 Sep 2026
    const startIso = "2026-09-25T00:00:00.000Z";
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const endIso = future.toISOString();

    const attemptsUrl = `https://apps.sarvam.ai/api/analytics/v1/${orgId}/${workspaceId}/${appId}/attempts?start_datetime=${encodeURIComponent(
      startIso
    )}&end_datetime=${encodeURIComponent(endIso)}&limit=100`;

    const sarvamRes = await fetch(attemptsUrl, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey.trim(),
        "API-Subscription-Key": apiKey.trim(),
      },
      cache: "no-store",
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      console.error(`Sarvam attempts API returned ${sarvamRes.status}:`, errText);
      return NextResponse.json(
        { error: `Sarvam API error (${sarvamRes.status}): ${errText}` },
        { status: sarvamRes.status }
      );
    }

    const data = await sarvamRes.json();
    const rawItems: any[] = data.items || [];
    const minTimestamp = new Date("2026-09-25T00:00:00Z").getTime();

    // Filter to legitimate parent phone calls starting strictly from 25 Sep 2026
    const phoneCalls = rawItems.filter((item: any) => {
      if (item.channel_direction !== "outbound") return false;
      if (isTestCall(item)) return false;
      const callTime = new Date(item.attempted_at || item.start_datetime || "").getTime();
      if (!isNaN(callTime) && callTime < minTimestamp) return false;
      return true;
    });

    // Sort newest first by UTC timestamp
    phoneCalls.sort((a, b) => {
      const getUtc = (dStr: string) => new Date(dStr ? (dStr.endsWith("Z") ? dStr : dStr + "Z") : 0).getTime();
      const timeA = getUtc(a.attempted_at || a.start_datetime);
      const timeB = getUtc(b.attempted_at || b.start_datetime);
      return timeB - timeA;
    });

    // Normalize into clean CallItem structure
    const calls = phoneCalls.map((item: any) => {
      const agentVars = item.agent_variables || {};
      const userPhone = item.user_contact || item.user_contact_masked || "";
      const cleanPhone = userPhone.replace(/[^0-9+]/g, "");

      // Check matched parent profile from Supabase
      const matchedProfile = cleanPhone
        ? phoneToParentMap.get(cleanPhone) ||
          (cleanPhone.startsWith("+91") ? phoneToParentMap.get(cleanPhone.slice(3)) : undefined)
        : undefined;

      const parentName =
        agentVars.parent_name ||
        matchedProfile?.name ||
        (cleanPhone ? `Parent (${cleanPhone.slice(-4)})` : "Parent");

      const childName = agentVars.child_name || matchedProfile?.child_name || "Family";

      // Ensure timestamp has UTC 'Z' indicator so browser converts to local IST time correctly
      const rawTimestamp = item.attempted_at || item.start_datetime || new Date().toISOString();
      const createdAt = rawTimestamp.endsWith("Z") ? rawTimestamp : rawTimestamp + "Z";

      return {
        id: item.attempt_id,
        attempt_id: item.attempt_id,
        interaction_id: item.interaction_id !== "NO_INTERACTION_ID" ? item.interaction_id : undefined,
        parent_name: parentName,
        parent_phone: userPhone,
        child_name: childName,
        call_status: item.connectivity_status || "unknown",
        duration_seconds: Math.round(item.duration_in_seconds || 0),
        call_outcome: agentVars.call_outcome || undefined,
        call_summary: agentVars.call_summary || undefined,
        health_update: agentVars.health_update || undefined,
        follow_up_detail: agentVars.follow_up_detail || undefined,
        follow_up_needed: agentVars.follow_up_needed || undefined,
        parent_mood: agentVars.parent_mood || undefined,
        mood_note: agentVars.mood_note || undefined,
        conversation_signal: agentVars.conversation_signal || undefined,
        ongoing_health_context: agentVars.ongoing_health_context || undefined,
        personal_context: agentVars.personal_context || undefined,
        agent_variables: agentVars,
        created_at: createdAt,
        language_name: item.language_name !== "UNKNOWN" ? item.language_name : undefined,
        num_messages: item.num_messages || 0,
        has_recording: item.interaction_id && item.interaction_id !== "NO_INTERACTION_ID" && (item.duration_in_seconds || 0) > 0,
        audio_url: item.audio_url || undefined,
      };
    });

    return NextResponse.json({
      success: true,
      calls,
      total: calls.length,
    });
  } catch (err: any) {
    console.error("Failed to fetch Sarvam calls:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch calls" },
      { status: 500 }
    );
  }
}
