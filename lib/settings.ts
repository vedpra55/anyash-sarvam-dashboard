import { getServiceSupabase } from "./supabase";

export const AGENT_VERSION_KEY = "sarvam_app_version";

/**
 * Reads the Sarvam agent version saved from the dashboard (app_settings table).
 * Returns null if nothing is saved or the lookup fails.
 */
export async function getSavedAgentVersion(): Promise<number | null> {
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", AGENT_VERSION_KEY)
      .maybeSingle();
    if (error || !data) return null;
    const version = Number(data.value);
    return Number.isInteger(version) && version > 0 ? version : null;
  } catch (err) {
    console.warn("Failed to read saved agent version:", err);
    return null;
  }
}

export async function saveAgentVersion(version: number): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: AGENT_VERSION_KEY,
      value: version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}
