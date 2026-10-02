/**
 * The two actors of a simulated call: the agent under test (its own prompt,
 * untouched, with the same end_interaction tool it has on Sarvam) and the
 * simulated parent (a persona).
 */
import { chatAgent, chatJson } from "./openai.ts";
import { renderTemplate, type Turn } from "./transcript.ts";

/** Sarvam's built-in end_interaction tool, word for word (agent Anyash-Heal, version 31). */
export const END_INTERACTION_TOOL = {
  type: "function",
  function: {
    name: "end_interaction",
    description:
      "Use this tool when you want to end the conversation gracefully when conversation reaches a natural end, or mentioned in the instructions or when the user requests to end the call. You should always generate a closing statement with this tool call. This message should be in the current language of the conversation.\nImportant: Only send the audio message as part of the tool parameter (end_message) and do not pass anything as content output.",
    parameters: {
      type: "object",
      properties: {
        end_message: {
          type: "string",
          description: "Closing statement to be sent when end_interaction is called,Example: 'Thank you for calling, have a great day!'",
        },
      },
      required: ["end_message"],
    },
  },
};

/** Appended after the prompt under test. It only explains the text format; it adds no behaviour and says nothing about ending the call. */
const HARNESS = `

---
TEST HARNESS (not part of the character): this is a text simulation of a phone call. Reply with only what Anyash says aloud. An empty parent message means the line was silent. The tool \`query_parent_history\` is not connected in this simulation: if it would be needed, say honestly that the record could not be loaded.`;

export function agentSystem(promptText: string, vars: Record<string, string | number>) {
  return renderTemplate(promptText, vars) + HARNESS;
}

/** One agent turn. The call ends only when the agent calls end_interaction, as on Sarvam; what it says is the closing line. */
export async function agentTurn(apiKey: string, system: string, turns: Turn[]) {
  const history = turns.map((t) => ({ role: t.role === "agent" ? ("assistant" as const) : ("user" as const), content: t.text }));
  const { content, toolCalls, tokens } = await chatAgent(apiKey, system, history, [END_INTERACTION_TOOL], "agent");
  const end = toolCalls.find((c) => c.name === "end_interaction");
  const closing = end ? String(end.args.end_message ?? "").trim() : "";
  const spoken = content.trim();
  const text = [spoken, closing && closing !== spoken ? closing : ""].filter(Boolean).join(" ");
  return { text, ends: Boolean(end), tokens };
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
- Stay on the line like a real parent: answering a question, or having nothing more to say, is not a reason to end the call. Set hangup to true only when the caller has said goodbye, or when your persona clearly says you hang up or walk away. A final goodbye of your own can go in "say".
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
