import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getServiceSupabase } from "@/lib/supabase";
import { SEED_SCENARIOS } from "@/lib/evalSeed";
import { cleanScenario } from "@/lib/evalScenarioInput";

export const dynamic = "force-dynamic";

const PROMPT_FILES = [
  { file: "anyash_v32_everyday_tips.txt", name: "Live prompt + everyday tips (v32 draft)" },
  { file: "anyash_v2.txt", name: "New short prompt (v2) + everyday tips" },
];

/** Adds or updates the starting scenarios and adds the saved prompts. Safe to run again. */
export async function POST() {
  const supabase = getServiceSupabase();
  const added = { scenarios: 0, updated: 0, prompts: 0, skippedPrompts: [] as string[] };

  // Starting scenarios are matched by slug: new ones are added and existing ones are brought up to
  // date with this file. Scenarios you created yourself (no slug, or another slug) are not touched.
  const { data: have } = await supabase.from("eval_scenarios").select("slug");
  const slugs = new Set((have || []).map((s) => s.slug));
  const rows: Record<string, unknown>[] = SEED_SCENARIOS.map((s) => cleanScenario(s)).flatMap((r) =>
    "value" in r ? [{ ...r.value, updated_at: new Date().toISOString() }] : [],
  );
  if (rows.length) {
    const { error } = await supabase.from("eval_scenarios").upsert(rows, { onConflict: "slug" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    added.scenarios = rows.filter((r) => !slugs.has(r.slug as string)).length;
    added.updated = rows.length - added.scenarios;
  }

  const { data: prompts } = await supabase.from("eval_prompts").select("name");
  const names = new Set((prompts || []).map((p) => p.name));
  for (const p of PROMPT_FILES) {
    if (names.has(p.name)) continue;
    try {
      const text = await readFile(path.join(process.cwd(), "prompts", p.file), "utf8");
      const { error } = await supabase.from("eval_prompts").insert({ name: p.name, text });
      if (error) throw error;
      added.prompts++;
    } catch {
      added.skippedPrompts.push(p.file);
    }
  }
  return NextResponse.json(added);
}
