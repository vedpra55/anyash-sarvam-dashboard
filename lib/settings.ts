import { createClient } from "@supabase/supabase-js";

export const AGENT_VERSION_KEY = "sarvam_app_version";

// Settings must always be read fresh: bypass Next.js's fetch cache.
function getSettingsClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vsljapxjdhqqaqvurajp.supabase.co";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET || "";
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

/**
 * Reads the Sarvam agent version saved from the dashboard (app_settings table).
 * Returns null if nothing is saved. Throws if the lookup fails.
 */
export async function readSavedAgentVersion(): Promise<number | null> {
  const { data, error } = await getSettingsClient()
    .from("app_settings")
    .select("value")
    .eq("key", AGENT_VERSION_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const version = Number(data.value);
  return Number.isInteger(version) && version > 0 ? version : null;
}

/** Same as readSavedAgentVersion, but returns null instead of throwing. */
export async function getSavedAgentVersion(): Promise<number | null> {
  try {
    return await readSavedAgentVersion();
  } catch (err) {
    console.warn("Failed to read saved agent version:", err);
    return null;
  }
}

export async function saveAgentVersion(version: number): Promise<void> {
  const { error } = await getSettingsClient().from("app_settings").upsert(
    {
      key: AGENT_VERSION_KEY,
      value: version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}
