/** OpenAI calls for the evals: the agent (text and tools, like on Sarvam), and JSON for the simulated parent and the judge. */
export const EVAL_MODEL = "gpt-6-luna";

type Msg = { role: "developer" | "user" | "assistant"; content: string };

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

async function complete(apiKey: string, messages: Msg[], effort: string, label: string, extra: Record<string, unknown> = {}) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EVAL_MODEL, reasoning_effort: effort, messages, ...extra }),
  });
  if (!res.ok) throw new Error(`[${label}] OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const message = data.choices?.[0]?.message || {};
  const toolCalls: ToolCall[] = (message.tool_calls || []).map((c: any) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(c.function?.arguments || "{}");
    } catch { /* keep empty */ }
    return { name: String(c.function?.name || ""), args };
  });
  const content = typeof message.content === "string" ? message.content : "";
  if (!content && toolCalls.length === 0) throw new Error(`[${label}] empty model answer`);
  return { content, toolCalls, tokens: Number(data.usage?.total_tokens) || 0 };
}

/**
 * One agent turn: the system prompt, the conversation so far, and the tools the agent has on Sarvam.
 * Reasoning is off: chat completions refuses function tools with reasoning on for this model, and
 * the agent on Sarvam answers straight away too.
 */
export async function chatAgent(
  apiKey: string,
  system: string,
  history: { role: "assistant" | "user"; content: string }[],
  tools: unknown[],
  label: string,
) {
  return complete(apiKey, [{ role: "developer", content: system }, ...history], "none", label, tools.length ? { tools } : {});
}

export async function chatJson<T>(apiKey: string, system: string, user: string, label: string, effort = "low"): Promise<{ result: T; tokens: number }> {
  const { content, tokens } = await complete(
    apiKey,
    [
      { role: "developer", content: system },
      { role: "user", content: user },
    ],
    effort,
    label,
    { response_format: { type: "json_object" } },
  );
  try {
    return { result: JSON.parse(content) as T, tokens };
  } catch {
    throw new Error(`[${label}] the model did not return JSON`);
  }
}
