/** OpenAI calls for the evals: plain text for the agent, JSON for the simulated parent and the judge. */
export const EVAL_MODEL = "gpt-6-luna";

type Msg = { role: "developer" | "user" | "assistant"; content: string };

async function complete(apiKey: string, messages: Msg[], effort: string, json: boolean, label: string) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EVAL_MODEL,
      reasoning_effort: effort,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`[${label}] OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error(`[${label}] empty model answer`);
  return { content, tokens: Number(data.usage?.total_tokens) || 0 };
}

/** One agent turn: the system prompt plus the conversation so far. */
export async function chatText(apiKey: string, system: string, history: { role: "assistant" | "user"; content: string }[], label: string) {
  return complete(apiKey, [{ role: "developer", content: system }, ...history], "low", false, label);
}

export async function chatJson<T>(apiKey: string, system: string, user: string, label: string, effort = "low"): Promise<{ result: T; tokens: number }> {
  const { content, tokens } = await complete(
    apiKey,
    [
      { role: "developer", content: system },
      { role: "user", content: user },
    ],
    effort,
    true,
    label,
  );
  try {
    return { result: JSON.parse(content) as T, tokens };
  } catch {
    throw new Error(`[${label}] the model did not return JSON`);
  }
}
