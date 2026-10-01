import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** The latest runs with a pass count each. */
export async function GET() {
  const supabase = getServiceSupabase();
  const { data: runs, error } = await supabase
    .from("eval_runs")
    .select("id, prompt_id, prompt_name, label, status, created_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (runs || []).map((r) => r.id);
  const { data: results } = ids.length
    ? await supabase.from("eval_results").select("run_id, status, passed").in("run_id", ids)
    : { data: [] as any[] };
  return NextResponse.json({
    runs: (runs || []).map((r) => ({ ...r, results: (results || []).filter((x) => x.run_id === r.id).map(({ status, passed }) => ({ status, passed })) })),
  });
}

/** Creates a run with one queued result per scenario. The page then steps each result. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const supabase = getServiceSupabase();
  const promptId = String(body.promptId || "");
  const scenarioIds: string[] = Array.isArray(body.scenarioIds) ? body.scenarioIds : [];
  if (!promptId) return NextResponse.json({ error: "Choose a prompt." }, { status: 400 });
  if (scenarioIds.length === 0) return NextResponse.json({ error: "Choose at least one scenario." }, { status: 400 });

  const [{ data: prompt }, { data: scenarios }] = await Promise.all([
    supabase.from("eval_prompts").select("id, name").eq("id", promptId).maybeSingle(),
    supabase.from("eval_scenarios").select("id, name").in("id", scenarioIds),
  ]);
  if (!prompt) return NextResponse.json({ error: "Prompt not found." }, { status: 404 });
  if (!scenarios?.length) return NextResponse.json({ error: "Scenarios not found." }, { status: 404 });

  const { data: run, error } = await supabase
    .from("eval_runs")
    .insert({ prompt_id: prompt.id, prompt_name: prompt.name, label: String(body.label || "").trim() || null })
    .select("id")
    .single();
  if (error || !run) return NextResponse.json({ error: error?.message || "Could not start the run." }, { status: 500 });

  const { data: results, error: resErr } = await supabase
    .from("eval_results")
    .insert(scenarios.map((s) => ({ run_id: run.id, scenario_id: s.id, scenario_name: s.name })))
    .select("id");
  if (resErr) return NextResponse.json({ error: resErr.message }, { status: 500 });
  return NextResponse.json({ runId: run.id, resultIds: (results || []).map((r) => r.id) });
}
