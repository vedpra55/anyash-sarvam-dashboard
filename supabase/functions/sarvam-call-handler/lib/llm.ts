/** One JSON-mode chat completion. Returns null (and logs) on any failure. */

export const AI_MODEL = "gpt-6-luna";

export type ReasoningEffort = "low" | "medium" | "high";

export interface LlmResult<T> {
  result: T | null;
  usage: any;
}

export async function chatJson<T = any>(
  openAiKey: string,
  systemPrompt: string,
  userPayload: string,
  { effort = "medium", label = "llm" }: { effort?: ReasoningEffort; label?: string } = {},
): Promise<LlmResult<T>> {
  if (!openAiKey) {
    console.error(`[${label}] OPENAI_API_KEY is not set`);
    return { result: null, usage: null };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        reasoning_effort: effort,
        messages: [
          { role: "developer", content: systemPrompt },
          { role: "user", content: userPayload },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error(`[${label}] OpenAI ${AI_MODEL} error:`, res.status, await res.text());
      return { result: null, usage: null };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return { result: content ? (JSON.parse(content) as T) : null, usage: data.usage || null };
  } catch (err) {
    console.error(`[${label}] model call failed:`, err);
    return { result: null, usage: null };
  }
}
