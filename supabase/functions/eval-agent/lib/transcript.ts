/**
 * A simulated call is a list of turns. Time is estimated from the words spoken,
 * because a text simulation has no audio: the real agent's calls are cut off at
 * 240 seconds, so the estimate lets us check the agent closes before that.
 */
export interface Turn {
  role: "agent" | "parent";
  text: string;
  /** On the agent turn that ended the call: what it said as a reply and what it passed as end_message. */
  end?: { said: string; end_message: string };
}

export const CALL_LIMIT_SECONDS = 240;
const AGENT_WORDS_PER_SECOND = 2.5;
const PARENT_WORDS_PER_SECOND = 2.2;
const TURN_GAP_SECONDS = 0.8;

export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function estimateSeconds(turns: Turn[]): number {
  let seconds = 0;
  for (const t of turns) {
    const rate = t.role === "agent" ? AGENT_WORDS_PER_SECOND : PARENT_WORDS_PER_SECOND;
    seconds += wordCount(t.text) / rate + TURN_GAP_SECONDS;
  }
  return Math.round(seconds);
}

export function talkStats(turns: Turn[]) {
  const agent = turns.filter((t) => t.role === "agent");
  const parent = turns.filter((t) => t.role === "parent");
  const agentWords = agent.reduce((n, t) => n + wordCount(t.text), 0);
  const parentWords = parent.reduce((n, t) => n + wordCount(t.text), 0);
  return {
    agentWords,
    parentWords,
    parentShare: agentWords + parentWords ? parentWords / (agentWords + parentWords) : 0,
    agentTurns: agent.length,
    parentTurns: parent.length,
    estSeconds: estimateSeconds(turns),
  };
}

/** Fills {{name}} and {{group.name}} placeholders; unknown ones are left as they are. */
export function renderTemplate(text: string, vars: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? whole : String(value);
  });
}

export function renderVars(v: {
  parent_name?: string;
  child_name?: string;
  honorific?: string;
  call_number?: number;
  user_context?: string;
}): Record<string, string | number> {
  const ist = new Date(Date.now() + 5.5 * 3_600_000).toISOString().replace("T", " ").slice(0, 16);
  return {
    parent_name: v.parent_name || "Sunita",
    child_name: v.child_name || "Priya",
    honorific: v.honorific || "Mummy Ji",
    number_of_calls: v.call_number || 1,
    user_context: v.user_context || "",
    "sarvam_variables.current_datetime": `${ist} IST`,
  };
}
