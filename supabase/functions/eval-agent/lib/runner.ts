/**
 * Runs one scenario against one prompt, a few exchanges per call so each
 * request stays short. State lives in eval_results, so a run can be resumed.
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { agentSystem, agentTurn, parentTurn } from "./agent.ts";
import { DEFAULT_CHECKS, overall, runDeterministic, type Check, type Ended } from "./graders.ts";
import { judge, type Criterion } from "./judge.ts";
import { CALL_LIMIT_SECONDS, estimateSeconds, renderTemplate, renderVars, talkStats, type Turn } from "./transcript.ts";

export const DEFAULT_OPENING = "Namaste {{honorific}}, main Anyaash bol raha hoon. Abhi baat kar sakte hain?";
const EXCHANGES_PER_STEP = 2;

export interface Scenario {
  id: string;
  name: string;
  kind: "simulation" | "scripted";
  persona: string;
  behaviours: string | null;
  language: string | null;
  parent_name: string | null;
  honorific: string | null;
  child_name: string | null;
  call_number: number;
  user_context: string | null;
  script: string[] | null;
  max_exchanges: number;
  checks: string[] | null;
  criteria: Criterion[] | null;
  notes: string | null;
}

export function varsFor(s: Pick<Scenario, "parent_name" | "child_name" | "honorific" | "call_number" | "user_context">) {
  return renderVars({
    parent_name: s.parent_name || undefined,
    child_name: s.child_name || undefined,
    honorific: s.honorific || undefined,
    call_number: s.call_number,
    user_context: s.user_context || undefined,
  });
}

/** Grades a finished (or manual) conversation: the counted checks, then the judged ones. */
export async function gradeCall(
  apiKey: string,
  turns: Turn[],
  ended: Ended,
  scenario: { name: string; persona?: string; notes?: string },
  checkIds: string[] | null,
  criteria: Criterion[] | null,
) {
  const ids = checkIds && checkIds.length ? checkIds : DEFAULT_CHECKS;
  const deterministic = runDeterministic(turns, ended, ids);
  const judged = await judge(apiKey, turns, scenario, ids, criteria || []);
  const byId = new Map<string, Check>([...deterministic, ...judged.checks].map((c) => [c.id, c]));
  const checks = ids.map((id) => byId.get(id)).filter((c): c is Check => Boolean(c));
  const all = [...checks, ...judged.criteria.map((c) => ({ ...c, id: `criterion:${c.id}` }))];
  return { checks, criteria: judged.criteria, passed: overall(all), tokens: judged.tokens };
}

export async function stepResult(supabase: SupabaseClient, apiKey: string, resultId: string, maxExchanges = EXCHANGES_PER_STEP) {
  const { data: row, error } = await supabase.from("eval_results").select("*").eq("id", resultId).maybeSingle();
  if (error || !row) throw new Error(error?.message || "Result not found");
  if (row.status === "done") return { done: true, result: row };

  const [{ data: run }, { data: scenario }] = await Promise.all([
    supabase.from("eval_runs").select("prompt_id").eq("id", row.run_id).maybeSingle(),
    supabase.from("eval_scenarios").select("*").eq("id", row.scenario_id).maybeSingle(),
  ]);
  if (!scenario) throw new Error("Scenario not found (deleted after the run was created)");
  const { data: prompt } = await supabase.from("eval_prompts").select("*").eq("id", run?.prompt_id).maybeSingle();
  if (!prompt) throw new Error("Prompt not found (deleted after the run was created)");

  const s = scenario as Scenario;
  const vars = varsFor(s);
  const system = agentSystem(prompt.text, vars);
  const turns: Turn[] = Array.isArray(row.transcript) ? (row.transcript as Turn[]) : [];
  let tokens = Number(row.tokens) || 0;
  let ended: Ended | null = (row.ended as Ended | null) || null;

  if (turns.length === 0) turns.push({ role: "agent", text: renderTemplate(prompt.opening_line || DEFAULT_OPENING, vars) });
  await supabase.from("eval_results").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", resultId);

  try {
    for (let i = 0; i < maxExchanges && !ended; i++) {
      const parentTurns = turns.filter((t) => t.role === "parent").length;
      let say = "";
      let hangup = false;
      if (s.kind === "scripted") {
        const line = s.script?.[parentTurns];
        if (line === undefined) {
          ended = "parent_hangup";
          break;
        }
        say = line;
      } else {
        const p = await parentTurn(apiKey, s, turns);
        say = p.say;
        hangup = p.hangup;
        tokens += p.tokens;
      }
      if (say || !hangup) turns.push({ role: "parent", text: say });
      if (hangup) {
        ended = "parent_hangup";
        break;
      }
      if (estimateSeconds(turns) >= CALL_LIMIT_SECONDS) {
        ended = "cutoff";
        break;
      }
      const a = await agentTurn(apiKey, system, turns);
      tokens += a.tokens;
      turns.push({ role: "agent", text: a.text });
      if (a.ends) {
        ended = "agent_end";
        break;
      }
      if (estimateSeconds(turns) >= CALL_LIMIT_SECONDS) {
        ended = "cutoff";
        break;
      }
      if (turns.filter((t) => t.role === "parent").length >= s.max_exchanges) ended = "limit";
    }

    if (!ended) {
      await supabase.from("eval_results").update({ transcript: turns, tokens, updated_at: new Date().toISOString() }).eq("id", resultId);
      return { done: false, exchanges: turns.filter((t) => t.role === "parent").length };
    }

    const graded = await gradeCall(apiKey, turns, ended, { name: s.name, persona: s.persona, notes: s.notes || undefined }, s.checks, s.criteria);
    const final = {
      status: "done",
      transcript: turns,
      ended,
      stats: talkStats(turns),
      grades: { checks: graded.checks, criteria: graded.criteria },
      passed: graded.passed,
      tokens: tokens + graded.tokens,
      error: null,
      updated_at: new Date().toISOString(),
    };
    await supabase.from("eval_results").update(final).eq("id", resultId);
    await finishRunIfDone(supabase, row.run_id);
    return { done: true, result: { ...row, ...final } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("eval_results")
      .update({ status: "error", transcript: turns, error: message, tokens, updated_at: new Date().toISOString() })
      .eq("id", resultId);
    await finishRunIfDone(supabase, row.run_id);
    throw err;
  }
}

async function finishRunIfDone(supabase: SupabaseClient, runId: string) {
  const { data } = await supabase.from("eval_results").select("status").eq("run_id", runId);
  if (data && data.length && data.every((r: { status: string }) => r.status === "done" || r.status === "error")) {
    await supabase.from("eval_runs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", runId);
  }
}
