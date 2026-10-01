import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getServiceSupabase()
    .from("eval_prompts")
    .select("id, name, text, opening_line, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prompts: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const text = String(body.text || "").trim();
  if (!name) return NextResponse.json({ error: "Give the prompt a name." }, { status: 400 });
  if (text.length < 50) return NextResponse.json({ error: "The prompt text is too short." }, { status: 400 });
  const opening = String(body.opening_line || "").trim() || null;
  const { data, error } = await getServiceSupabase()
    .from("eval_prompts")
    .insert({ name, text, opening_line: opening })
    .select("id, name, text, opening_line, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prompt: data });
}
