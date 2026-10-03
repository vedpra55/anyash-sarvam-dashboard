import { NextRequest, NextResponse } from "next/server";
import { callEvalAgent } from "@/lib/evalsServer";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Manual testing: one agent turn for the conversation typed so far. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const supabase = getServiceSupabase();
  const { data: prompt } = await supabase.from("eval_prompts").select("text, opening_line").eq("id", String(body.promptId || "")).maybeSingle();
  if (!prompt) return NextResponse.json({ error: "Choose a prompt first." }, { status: 400 });
  try {
    const r = await callEvalAgent({
      action: "reply",
      prompt_text: prompt.text,
      opening_line: prompt.opening_line,
      vars: body.vars || {},
      turns: Array.isArray(body.turns) ? body.turns : [],
    });
    return NextResponse.json(r.data, { status: r.ok ? 200 : r.status || 502 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "The eval service did not answer." }, { status: 502 });
  }
}
