import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { cleanScenario } from "@/lib/evalScenarioInput";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getServiceSupabase().from("eval_scenarios").select("*").order("group_name").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scenarios: data || [] });
}

export async function POST(req: NextRequest) {
  const parsed = cleanScenario(await req.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await getServiceSupabase().from("eval_scenarios").insert(parsed.value).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scenario: data });
}
