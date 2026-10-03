/** The model-judged checks and each scenario's own behaviour criteria. */
import { chatJson } from "./openai.ts";
import { CHECKS, type Check } from "./graders.ts";
import type { Turn } from "./transcript.ts";

export interface Criterion {
  id: string;
  text: string;
}

const JUDGE_SYSTEM = `You grade one simulated phone call between "Anyash", a voice health companion, and an elderly parent. You are strict, fair and specific.
You are given the transcript, a note on what this scenario tests, the checks to apply, and any extra criteria for this scenario.

For every check and criterion decide:
- "applies": false only when the situation it covers never happened in the call (for example "feelings" when the parent never shared anything hard). Otherwise true.
- "pass": true or false.
- "reason": one short sentence that quotes the exact words of the transcript that decided it.

Judge only what was said in the transcript. A criterion is about the AGENT's behaviour unless it says otherwise. When unsure whether something broke a rule, it did not.

Return JSON only:
{ "checks": { "<id>": { "applies": true, "pass": true, "reason": "..." } }, "criteria": [ { "id": "<id>", "applies": true, "pass": true, "reason": "..." } ] }`;

type Verdict = { applies?: boolean; pass?: boolean; reason?: string };

export async function judge(
  apiKey: string,
  turns: Turn[],
  scenario: { name: string; persona?: string; notes?: string },
  checkIds: string[],
  criteria: Criterion[],
) {
  const judged = checkIds.filter((id) => CHECKS[id]?.judged);
  if (judged.length === 0 && criteria.length === 0) return { checks: [] as Check[], criteria: [] as Check[], tokens: 0 };

  const transcript = turns.map((t) => `${t.role === "agent" ? "ANYASH" : "PARENT"}: ${t.text}`).join("\n");
  const user = `Scenario: ${scenario.name}
${scenario.persona ? `The parent is: ${scenario.persona}\n` : ""}${scenario.notes ? `What it tests: ${scenario.notes}\n` : ""}
Checks to apply:
${judged.map((id) => `- ${id}: ${CHECKS[id].meaning}`).join("\n") || "(none)"}

Extra criteria for this scenario:
${criteria.map((c) => `- ${c.id}: ${c.text}`).join("\n") || "(none)"}

Transcript:
${transcript}`;

  const { result, tokens } = await chatJson<{ checks?: Record<string, Verdict>; criteria?: (Verdict & { id: string })[] }>(
    apiKey,
    JUDGE_SYSTEM,
    user,
    "judge",
    "medium",
  );
  const toCheck = (id: string, v?: Verdict): Check =>
    !v
      ? { id, pass: null, reason: "The judge gave no verdict." }
      : v.applies === false
        ? { id, pass: null, reason: v.reason || "Did not apply in this call." }
        : { id, pass: Boolean(v.pass), reason: v.reason || "" };

  return {
    checks: judged.map((id) => toCheck(id, result.checks?.[id])),
    criteria: criteria.map((c) => toCheck(c.id, result.criteria?.find((x) => x.id === c.id))),
    tokens,
  };
}
