/**
 * The two actors of a simulated call: the agent under test (its own prompt,
 * untouched) and the simulated parent (a persona).
 */
import { chatJson, chatText } from "./openai.ts";
import { type Turn, renderTemplate } from "./transcript.ts";

export const END_MARK = "<END_CALL>";

/** Appended after the prompt under test. It only explains the text format; it adds no behaviour. */
const HARNESS = `

---
TEST HARNESS (not part of the character): this is a text simulation of a phone call. Reply with only what Anyash says aloud. When Anyash would end the call (the equivalent of calling end_interaction), finish that message with ${END_MARK}. An empty parent message means the line was silent. The tool \`query_parent_history\` is not connected in this simulation: if it would be needed, say honestly that the record could not be loaded.`;

export function agentSystem(promptText: string, vars: Record<string, string | number>) {
  return renderTemplate(promptText, vars) + HARNESS;
}

export async function agentTurn(apiKey: string, system: string, turns: Turn[]) {
  const history = turns.map((t) => ({ role: t.role === "agent" ? ("assistant" as const) : ("user" as const), content: t.text }));
  const { content, tokens } = await chatText(apiKey, system, history, "agent");
  const ends = content.includes(END_MARK);
  const text = content.replace(END_MARK, "").trim();
  return { text, ends, tokens };
}

export interface ParentPersona {
  persona: string;
  behaviours?: string | null;
  language?: string | null;
}

const PARENT_SYSTEM = `You play one person in a phone call. You are not an assistant and you never break character.
The phone rang and a caller who says they are from a health companion service has started talking to you. Respond exactly as the person described below would.

Rules:
- Speak the way a real person talks on the phone: usually one or two short sentences, sometimes just a word. No lists, no long explanations unless the persona would give them.
- Use the language and mix of languages in the description. Write Hindi in Roman letters (Hinglish) unless told otherwise; write Telugu or other languages in their own script only if told to.
- Only know what the persona knows. Do not invent a different situation, and never mention that this is a test, a simulation or an AI.
- Do not be helpful to the caller on purpose. Answer what you are asked, in your own way.
- When the conversation has naturally finished (the caller said goodbye) or your persona would hang up or walk away, set hangup to true. A final goodbye of your own can go in "say".
- If the persona would stay silent, "say" is an empty string.

Return JSON only: { "say": "what you say", "hangup": false }`;

export async function parentTurn(apiKey: string, p: ParentPersona, turns: Turn[]) {
  const lines = turns.map((t) => `${t.role === "agent" ? "CALLER" : "YOU"}: ${t.text}`).join("\n");
  const user = `You are: ${p.persona}
${p.behaviours ? `How you behave: ${p.behaviours}\n` : ""}Language: ${p.language || "Hinglish"}

The call so far:
${lines}

What do you say next?`;
  const { result, tokens } = await chatJson<{ say?: string; hangup?: boolean }>(apiKey, PARENT_SYSTEM, user, "parent");
  return { say: String(result.say ?? "").trim(), hangup: Boolean(result.hangup), tokens };
}
