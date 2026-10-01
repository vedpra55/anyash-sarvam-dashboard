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

/** Adds the starting scenarios and the saved prompts. Safe to run again: it only adds what is missing. */
export async function POST() {
  const supabase = getServiceSupabase();
  const added = { scenarios: 0, prompts: 0, skippedPrompts: [] as string[] };

  const { data: have } = await supabase.from("eval_scenarios").select("slug");
  const slugs = new Set((have || []).map((s) => s.slug));
  const rows = SEED_SCENARIOS.filter((s) => !slugs.has(s.slug))
    .map((s) => cleanScenario(s))
    .flatMap((r) => ("value" in r ? [r.value] : []));
  if (rows.length) {
    const { error } = await supabase.from("eval_scenarios").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    added.scenarios = rows.length;
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
