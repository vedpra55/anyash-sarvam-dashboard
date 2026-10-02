/**
 * The two actors of a simulated call: the agent under test (its own prompt,
 * untouched, with the same end_interaction tool it has on Sarvam) and the
 * simulated parent (a persona).
 */
import { chatAgent, chatJson } from "./openai.ts";
import { renderTemplate, type Turn } from "./transcript.ts";

/**
 * The end_interaction tool the agent has on Sarvam: same name and end_message parameter.
 *
 * The description is not Sarvam's word for word. Sarvam's says "Only send the audio message as part
 * of the tool parameter (end_message) and do not pass anything as content output", which Sarvam's own
 * runtime handles but OpenAI's model reads as "speak through this tool": it called end_interaction
 * with ordinary replies and the calls ended after one or two turns. This wording keeps Sarvam's
 * meaning (end gracefully at a natural end, or when the instructions or the user say so, with a
 * closing statement in the conversation's language) and makes clear it is only for the end.
 */
export const END_INTERACTION_TOOL = {
  type: "function",
  function: {
    name: "end_interaction",
    description:
      "Hang up the phone call. Use it only when the conversation has reached its natural end, when your instructions say to end the call, or when the user wants to end the call. Never use it to say an ordinary reply: while the conversation is still going, answer as normal text and do not call this tool. When you do end the call, put your closing statement (the goodbye, in the current language of the conversation) in end_message.",
    parameters: {
      type: "object",
      properties: {
        end_message: {
          type: "string",
          description: "The closing statement spoken just before the call is hung up, for example a warm goodbye.",
        },
      },
      required: ["end_message"],
    },
  },
};

/** Appended after the prompt under test. It only explains the text format; it adds no behaviour and says nothing about ending the call. */
const HARNESS = `

---
TEST HARNESS (not part of the character): this is a text simulation of a phone call. Reply with only what Anyash says aloud; it is read out by text to speech. As on the real calls, write Hindi in Devanagari script (English words may stay in Latin script). The parent's messages are a speech-to-text transcript of what they said. An empty parent message means the line was silent. The tool \`query_parent_history\` is not connected in this simulation: if it would be needed, say honestly that the record could not be loaded.`;

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
  // Kept on the turn so a call that ends early can be checked: was it a goodbye, or a reply sent through the tool?
  return { text, ends: Boolean(end), end: end ? { said: spoken, end_message: closing } : undefined, tokens };
}

export interface ParentPersona {
  persona: string;
  behaviours?: string | null;
  language?: string | null;
}

/**
 * How real parents answered on real Anyash calls (Sarvam transcripts, names removed).
 * They show the simulated parent the length, words and grammar of a real answer.
 */
export const REAL_PARENT_LINES = [
  "कौन?",
  "हाँ, हेलो।",
  "हाँ हाँ कर सकते हैं।",
  "हां वेरी गुड।",
  "हाँ सब ठीक-ठाक।",
  "अच्छा रहा। आज थोड़ा धूप निकला था। कल बारिश हुआ था।",
  "सुबह हम पाँच बजे उठते हैं, फिर उसके बाद नहाते हैं।",
  "नौ बज जाता है, नौ साढ़े आठ, नौ।",
  "उसमें वो तो रोटी ही खाते हैं लोग, तो रोटी सब्जी।",
  "दोपहर में तो चावल दाल बनाते हैं।",
  "नहीं, कभी मल्टीविटामिन ले लेते हैं।",
  "एक पैर में दर्द रहता है मेरा कभी-कभी।",
  "दिन भर काम करने के बाद।",
  "नहीं, घुटना में ही।",
  "सबसे पहले गर्म पानी पीते हैं।",
  "घर पर ही कुछ काम-वाम करते हैं, टहलते-वलते हैं।",
  "नहीं नहीं, समय पर अपना खाना खा लेते हैं।",
  "ग्यारह बारह बजे सोते हैं।",
  "डॉक्टर ने बताई है।",
  "नहीं वो तो नहीं है, शुगर है।",
  "ना ना, कहीं नहीं रहता है।",
  "हम्म, नींद बहुत अच्छी आती है। साढ़े दस बजे सोते हैं।",
];

/**
 * The simulated parent, built the way voice platforms build their simulated
 * callers: a brief of who they are and what they know, improvised one line at a
 * time, never giving everything away at once (the tau-bench user-simulator rules),
 * and speaking like the real parents above.
 */
const PARENT_SYSTEM = `You play an elderly Indian parent who has picked up a phone call. You are not an assistant and you never break character, never mention a test, a simulation or an AI.

What the caller receives is a speech-to-text transcript of you. So write exactly what you say out loud, the way the transcript shows it:
- Hindi in Devanagari. English words you use are written in Devanagari as heard (मल्टीविटामिन, मेडिसिन, वेरी गुड). If your language is given as something else, use that language and script.
- Spoken, not written: no semicolons, dashes, lists or quotation marks. Short, sometimes broken sentences, small grammar slips, words like हाँ, अच्छा, हम्म, अरे, echo words like काम-वाम.
- Many elderly parents say हम for themselves and talk about "लोग" (रोटी ही खाते हैं लोग).

How real parents answer, from real calls:
${REAL_PARENT_LINES.map((l) => `- ${l}`).join("\n")}

Rules for every turn:
1. Answer only what was just asked. Most answers are 2 to 8 words; never more than two short sentences, unless your brief says you are chatty or the moment is something you want to talk about.
2. Never give everything away at once. What your brief says about you is what you know, not a script: reveal one fact only when a question needs it. Never list your day, your health or your plans in one answer.
3. If the caller asks two things at once, answer one of them, usually the last.
4. Do not invent facts that are not in your brief. If asked something you do not know, say so the way a person would (पता नहीं, याद नहीं).
5. Do not thank the caller, praise their answers, or comment on how well they explained. Ask at most one question in a turn, and only if your brief gives you a reason.
6. If you did not follow what the caller said, or a turn is long and confusing, say so briefly: हाँ? क्या? कौन?
7. Follow your brief's situation and mood, and the moments it describes, at the point in the call where they fit.
8. Stay on the line. Answering, or having nothing to add, is not a reason to hang up. Set hangup to true only after the caller says goodbye, or when your brief says you hang up or walk away. Your own short goodbye can go in "say".
9. If you would stay silent, "say" is an empty string.

Return JSON only: { "say": "what you say", "hangup": false }`;

export async function parentTurn(apiKey: string, p: ParentPersona, turns: Turn[]) {
  const lines = turns.map((t) => `${t.role === "agent" ? "CALLER" : "YOU"}: ${t.text || "(silence)"}`).join("\n");
  const user = `WHO YOU ARE AND WHAT YOU KNOW (private, reveal only when asked):
${p.persona}
${p.behaviours ? `\nHOW YOU ARE IN THIS CALL:\n${p.behaviours}\n` : ""}
LANGUAGE: ${p.language && !/^hinglish$/i.test(p.language.trim()) ? p.language : "Hindi with some English words, as a Devanagari transcript"}

THE CALL SO FAR:
${lines}

What do you say next? One turn only.`;
  const { result, tokens } = await chatJson<{ say?: string; hangup?: boolean }>(apiKey, PARENT_SYSTEM, user, "parent");
  return { say: String(result.say ?? "").trim(), hangup: Boolean(result.hangup), tokens };
}
