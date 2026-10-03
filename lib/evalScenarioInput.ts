import { ALL_CHECKS } from "./evals";

const str = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
};

/** Validates a scenario from the form or an API caller and returns the row to store. */
export function cleanScenario(raw: any): { value: Record<string, unknown> } | { error: string } {
  const name = str(raw?.name);
  const persona = str(raw?.persona);
  if (!name) return { error: "Give the scenario a name." };
  if (!persona) return { error: "Describe the simulated parent." };

  const kind = raw?.kind === "scripted" ? "scripted" : "simulation";
  let script: string[] | null = null;
  if (kind === "scripted") {
    const lines = (Array.isArray(raw?.script) ? raw.script : String(raw?.script || "").split("\n"))
      .map((l: unknown) => String(l).trim())
      .filter(Boolean);
    if (lines.length === 0) return { error: "A scripted scenario needs at least one parent line." };
    script = lines;
  }

  const checks = Array.isArray(raw?.checks) ? raw.checks.filter((c: string) => (ALL_CHECKS as string[]).includes(c)) : null;
  const criteria = (Array.isArray(raw?.criteria) ? raw.criteria : [])
    .map((c: any, i: number) => ({
      id: String(c?.id || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `criterion_${i + 1}`,
      text: String(c?.text || "").trim(),
    }))
    .filter((c: { text: string }) => c.text);

  const callNumber = Math.max(1, Math.round(Number(raw?.call_number) || 3));
  const maxExchanges = Math.min(40, Math.max(1, Math.round(Number(raw?.max_exchanges) || 12)));

  return {
    value: {
      slug: str(raw?.slug),
      name,
      group_name: str(raw?.group_name) || "Custom",
      kind,
      persona,
      behaviours: str(raw?.behaviours),
      language: str(raw?.language),
      parent_name: str(raw?.parent_name),
      honorific: str(raw?.honorific),
      child_name: str(raw?.child_name),
      call_number: callNumber,
      user_context: str(raw?.user_context),
      script,
      max_exchanges: maxExchanges,
      checks: checks && checks.length ? checks : null,
      criteria,
      notes: str(raw?.notes),
    },
  };
}
