export interface SarvamCallRecord {
  id: string;
  attempt_id: string;
  interaction_id?: string;
  parent_name: string;
  parent_phone: string;
  child_name: string;
  call_status: string;
  duration_seconds: number;
  call_outcome?: string;
  call_summary?: string;
  health_update?: string;
  conversation_signal?: string;
  follow_up_needed?: string;
  follow_up_detail?: string;
  parent_mood?: string;
  mood_note?: string;
  ongoing_health_context?: string;
  personal_context?: string;
  agent_variables?: Record<string, any>;
  created_at: string;
  language_name?: string;
  num_messages?: number;
  has_recording: boolean;
  audio_url?: string;
}

export function isTestCall(item: any): boolean {
  const contact = (item.user_contact || item.user_contact_masked || "").toLowerCase();
  const agentVars = item.agent_variables || {};
  const parentName = (agentVars.parent_name || "").toLowerCase();

  // Filter out web test sessions (e.g. vedna400@gmail.com)
  if (contact.includes("@")) return true;

  // Filter out explicit test dummy numbers
  const digits = contact.replace(/\D/g, "");
  if (digits.includes("9876543210") || digits.includes("1234567890")) return true;

  // Filter out items named explicitly "Test" with 0s duration and no conversation
  if (parentName === "test" && (item.duration_in_seconds || 0) < 5) return true;

  return false;
}

export type SarvamAttemptsResult =
  | { ok: true; items: any[] }
  | { ok: false; status: number; error: string };

const ATTEMPTS_TTL_MS = 15_000;
let attemptsCache: { at: number; promise: Promise<SarvamAttemptsResult> } | null = null;

/**
 * Raw call attempts from Sarvam Analytics since 25 Sep 2026 (intentional cutoff).
 *
 * /api/parents and /api/calls both need this list, often at the same moment, so
 * one request is shared: concurrent callers reuse the in-flight fetch and the
 * result is reused for 15 seconds. Failures are not cached.
 */
export function getSarvamAttempts(limit = 100): Promise<SarvamAttemptsResult> {
  if (attemptsCache && Date.now() - attemptsCache.at < ATTEMPTS_TTL_MS) {
    return attemptsCache.promise;
  }
  const promise = fetchSarvamAttempts(limit).then((result) => {
    if (!result.ok && attemptsCache?.promise === promise) attemptsCache = null;
    return result;
  });
  attemptsCache = { at: Date.now(), promise };
  return promise;
}

async function fetchSarvamAttempts(limit: number): Promise<SarvamAttemptsResult> {
  const apiKey = process.env.SARVAM_API_KEY || "";
  const orgId = process.env.SARVAM_ORG_ID || "";
  const workspaceId = process.env.SARVAM_WORKSPACE_ID || "";
  const appId = process.env.SARVAM_APP_ID || "";

  if (!apiKey || !orgId || !workspaceId || !appId) {
    return { ok: false, status: 500, error: "Sarvam environment variables not configured" };
  }

  // Strictly fetch only calls on or after 25 Sep 2026
  const startIso = "2026-09-25T00:00:00.000Z";
  const future = new Date();
  future.setDate(future.getDate() + 1);
  const endIso = future.toISOString();

  const attemptsUrl = `https://apps.sarvam.ai/api/analytics/v1/${orgId}/${workspaceId}/${appId}/attempts?start_datetime=${encodeURIComponent(
    startIso
  )}&end_datetime=${encodeURIComponent(endIso)}&limit=${limit}`;

  try {
    const res = await fetch(attemptsUrl, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey.trim(),
        "API-Subscription-Key": apiKey.trim(),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Sarvam attempts API returned ${res.status}:`, errText);
      return { ok: false, status: res.status, error: `Sarvam API error (${res.status}): ${errText}` };
    }
    const data = await res.json();
    return { ok: true, items: data.items || [] };
  } catch (err: any) {
    console.error("Failed to query Sarvam attempts API:", err);
    return { ok: false, status: 502, error: err?.message || "Could not reach Sarvam" };
  }
}

export async function fetchSarvamCalls(options?: {
  daysBack?: number;
  limit?: number;
}): Promise<SarvamCallRecord[]> {
  try {
    const result = await getSarvamAttempts(options?.limit ?? 100);
    if (!result.ok) {
      console.warn("Sarvam calls unavailable:", result.error);
      return [];
    }

    const rawItems: any[] = result.items;
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
      const getUtc = (dStr: string) =>
        new Date(dStr ? (dStr.endsWith("Z") ? dStr : dStr + "Z") : 0).getTime();
      const timeA = getUtc(a.attempted_at || a.start_datetime);
      const timeB = getUtc(b.attempted_at || b.start_datetime);
      return timeB - timeA;
    });

    return phoneCalls.map((item: any) => {
      const agentVars = item.agent_variables || {};
      const userPhone = item.user_contact || item.user_contact_masked || "";
      const rawTimestamp = item.attempted_at || item.start_datetime || new Date().toISOString();
      const createdAt = rawTimestamp.endsWith("Z") ? rawTimestamp : rawTimestamp + "Z";

      return {
        id: item.attempt_id,
        attempt_id: item.attempt_id,
        interaction_id: item.interaction_id !== "NO_INTERACTION_ID" ? item.interaction_id : undefined,
        parent_name: agentVars.parent_name || "",
        parent_phone: userPhone,
        child_name: agentVars.child_name || "Family",
        call_status: item.connectivity_status || "unknown",
        duration_seconds: Math.round(item.duration_in_seconds || 0),
        call_outcome: agentVars.call_outcome || undefined,
        call_summary: agentVars.call_summary || undefined,
        health_update: agentVars.health_update || undefined,
        conversation_signal: agentVars.conversation_signal || undefined,
        follow_up_needed: agentVars.follow_up_needed || undefined,
        follow_up_detail: agentVars.follow_up_detail || undefined,
        parent_mood: agentVars.parent_mood || undefined,
        mood_note: agentVars.mood_note || undefined,
        ongoing_health_context: agentVars.ongoing_health_context || undefined,
        personal_context: agentVars.personal_context || undefined,
        agent_variables: agentVars,
        created_at: createdAt,
        language_name: item.language_name !== "UNKNOWN" ? item.language_name : undefined,
        num_messages: item.num_messages || 0,
        has_recording:
          Boolean(item.interaction_id) &&
          item.interaction_id !== "NO_INTERACTION_ID" &&
          (item.duration_in_seconds || 0) > 0,
        audio_url: item.audio_url || undefined,
      };
    });
  } catch (err) {
    console.error("Failed to query Sarvam attempts API:", err);
    return [];
  }
}

/**
 * Links Sarvam calls to parent profiles by matching the last 10 digits of their phone numbers.
 */
export function linkCallsToParents(parents: any[], calls: SarvamCallRecord[]): any[] {
  return parents.map((parent) => {
    const parentPhoneDigits = (parent.phone_number || "").replace(/\D/g, "").slice(-10);

    const matchingCalls = calls.filter((c) => {
      const callPhoneDigits = (c.parent_phone || "").replace(/\D/g, "").slice(-10);
      return parentPhoneDigits && callPhoneDigits && parentPhoneDigits === callPhoneDigits;
    });

    const latestCall = matchingCalls[0] || null;

    // Keep parent.number_of_calls from Supabase as canonical truth.
    // If not set, calculate next call count based on completed matching calls.
    const effectiveCallCount =
      typeof parent.number_of_calls === "number" && parent.number_of_calls > 0
        ? parent.number_of_calls
        : matchingCalls.length > 0
        ? matchingCalls.length + 1
        : 1;

    return {
      ...parent,
      latestCall,
      calls: matchingCalls,
      number_of_calls: effectiveCallCount,
    };
  });
}
