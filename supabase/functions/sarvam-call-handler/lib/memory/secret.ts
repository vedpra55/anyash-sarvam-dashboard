/** Internal calls to the memory functions carry x-memory-secret (from public.internal_config). */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isInternalCall(supabase: SupabaseClient, req: Request): Promise<boolean> {
  const given = req.headers.get("x-memory-secret") || "";
  if (!given) return false;
  const { data } = await supabase.from("internal_config").select("value").eq("key", "memory_secret").maybeSingle();
  return Boolean(data?.value) && sameString(given, data!.value);
}
