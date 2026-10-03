import { getServiceSupabase, supabaseUrl } from "./supabase";

/** Calls the eval-agent edge function with the shared internal secret. */
export async function callEvalAgent<T = any>(body: Record<string, unknown>, timeoutMs = 55_000): Promise<{ ok: boolean; status: number; data: T }> {
  const supabase = getServiceSupabase();
  const { data: secret } = await supabase.from("internal_config").select("value").eq("key", "memory_secret").maybeSingle();
  if (!secret?.value) return { ok: false, status: 500, data: { error: "No internal secret is configured" } as T };
  const res = await fetch(`${supabaseUrl}/functions/v1/eval-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-memory-secret": secret.value },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({ error: `eval-agent returned ${res.status}` }))) as T;
  return { ok: res.ok, status: res.status, data };
}
