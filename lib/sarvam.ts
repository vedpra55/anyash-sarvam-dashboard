import { TRIAL_START_ISO, testReason, attemptTime } from "./trial";

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

/** Sarvam's call attempt id (the REST API calls it attempt_id, some reports job_id). */
export function attemptIdOf(item: any): string {
  return item?.attempt_id || item?.job_id || "";
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
export function getSarvamAttempts(): Promise<SarvamAttemptsResult> {
  if (attemptsCache && Date.now() - attemptsCache.at < ATTEMPTS_TTL_MS) {
    return attemptsCache.promise;
  }
  const promise = fetchSarvamAttempts().then((result) => {
    if (!result.ok && attemptsCache?.promise === promise) attemptsCache = null;
    return result;
  });
  attemptsCache = { at: Date.now(), promise };
  return promise;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/** Every attempt since the trial started, following pages until Sarvam has no more. */
async function fetchSarvamAttempts(): Promise<SarvamAttemptsResult> {
  const apiKey = process.env.SARVAM_API_KEY || "";
  const orgId = process.env.SARVAM_ORG_ID || "";
  const workspaceId = process.env.SARVAM_WORKSPACE_ID || "";
  const appId = process.env.SARVAM_APP_ID || "";

  if (!apiKey || !orgId || !workspaceId || !appId) {
    return { ok: false, status: 500, error: "Sarvam environment variables not configured" };
  }

  const future = new Date();
  future.setDate(future.getDate() + 1);
  const base = `https://apps.sarvam.ai/api/analytics/v1/${orgId}/${workspaceId}/${appId}/attempts?start_datetime=${encodeURIComponent(
    TRIAL_START_ISO
  )}&end_datetime=${encodeURIComponent(future.toISOString())}&limit=${PAGE_SIZE}`;

  const items: any[] = [];
  const seen = new Set<string>();
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetch(`${base}&offset=${page * PAGE_SIZE}`, {
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
      const pageItems: any[] = data.items || [];
      // Stop on a short page, or if the API ignored the offset and repeated a page.
      let added = 0;
      for (const item of pageItems) {
        const id = attemptIdOf(item) || JSON.stringify([item.attempted_at, item.user_contact_hashed]);
        if (seen.has(id)) continue;
        seen.add(id);
        items.push(item);
        added++;
      }
      const more = data.pagination?.more ?? pageItems.length >= PAGE_SIZE;
      if (!more || added === 0) break;
    }
    return { ok: true, items };
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
    const result = await getSarvamAttempts();
    if (!result.ok) {
      console.warn("Sarvam calls unavailable:", result.error);
      return [];
    }

    // Real trial calls only (the shared rule in lib/trial.ts).
    const phoneCalls = result.items.filter((item: any) => testReason(item) === null);

    // Sort newest first by UTC timestamp
    phoneCalls.sort((a, b) => attemptTime(b) - attemptTime(a));

    return phoneCalls.map((item: any) => {
      const agentVars = item.agent_variables || {};
      const userPhone = item.user_contact || item.user_contact_masked || "";
      const rawTimestamp = item.attempted_at || item.start_datetime || new Date().toISOString();
      const createdAt = rawTimestamp.endsWith("Z") ? rawTimestamp : rawTimestamp + "Z";

      return {
        id: attemptIdOf(item),
        attempt_id: attemptIdOf(item),
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
