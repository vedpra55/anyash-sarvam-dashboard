/**
 * Pre-call briefs (Phase 3). The outbound route asks the build-brief edge
 * function for a brief before each call. In "shadow" mode the brief is only
 * saved and the old user_context is still sent; in "live" mode the brief is
 * sent as user_context. Either way the call_briefs row records what was sent.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type BriefMode = "shadow" | "live" | "off";

export const BRIEF_MODE_KEY = "memory_brief_mode";
const BRIEF_TIMEOUT_MS = 25_000;

export interface Brief {
  briefId: string;
  brief: string;
  callNumber: number;
}

/** app_settings stores the mode as JSON ("shadow"); anything unknown means shadow. */
export function parseBriefMode(value: unknown): BriefMode {
  const mode = String(value ?? "").replace(/"/g, "").trim().toLowerCase();
  return mode === "live" || mode === "off" ? mode : "shadow";
}

/**
 * The user_context to send: the brief only in live mode and only when one was
 * built. A manual override from the dashboard always wins.
 */
export function chooseUserContext(opts: {
  mode: BriefMode;
  brief: Brief | null;
  oldContext: string;
  override?: string;
}): { context: string; usedBrief: boolean } {
  if (opts.override && opts.override.trim()) return { context: opts.override.trim(), usedBrief: false };
  if (opts.mode === "live" && opts.brief?.brief) return { context: opts.brief.brief, usedBrief: true };
  return { context: opts.oldContext, usedBrief: false };
}

export async function readBriefMode(supabase: SupabaseClient): Promise<BriefMode> {
  const { data, error } = await supabase.from("app_settings").select("value").eq("key", BRIEF_MODE_KEY).maybeSingle();
  if (error) {
    console.warn("Could not read memory_brief_mode; using shadow:", error.message);
    return "shadow";
  }
  return parseBriefMode(data?.value);
}

/** Asks build-brief for a brief. Returns null (never throws) when it can't. */
export async function requestBrief(
  supabase: SupabaseClient,
  supabaseUrl: string,
  parentId: string,
  callNumber: number,
  mode: "shadow" | "live",
): Promise<Brief | null> {
  try {
    const { data: secret } = await supabase.from("internal_config").select("value").eq("key", "memory_secret").maybeSingle();
    if (!secret?.value) {
      console.warn("No memory_secret in internal_config; brief skipped");
      return null;
    }
    const res = await fetch(`${supabaseUrl}/functions/v1/build-brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-memory-secret": secret.value },
      body: JSON.stringify({ parent_id: parentId, call_number: callNumber, mode }),
      signal: AbortSignal.timeout(BRIEF_TIMEOUT_MS),
      cache: "no-store",
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.briefId || !out?.brief) {
      console.warn(`build-brief returned ${res.status}:`, out?.error || out);
      return null;
    }
    return { briefId: out.briefId, brief: out.brief, callNumber: out.callNumber ?? callNumber };
  } catch (err) {
    console.warn("build-brief failed:", err);
    return null;
  }
}

/** Links the brief to the call and records the user_context that was actually sent. */
export async function recordBriefUse(
  supabase: SupabaseClient,
  briefId: string,
  attemptId: string | null,
  sentUserContext: string,
  usedInCall: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("call_briefs")
    .update({ attempt_id: attemptId, sent_user_context: sentUserContext, used_in_call: usedInCall })
    .eq("id", briefId);
  if (error) console.warn(`Could not update call_briefs ${briefId}:`, error.message);
}
