import { NextRequest, NextResponse } from "next/server";
import { callEvalAgent } from "@/lib/evalsServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Grades a manual conversation (or any transcript) with the same checks as the auto runs. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const r = await callEvalAgent({
      action: "grade",
      turns: body.turns,
      ended: body.ended,
      scenario: body.scenario,
      checks: body.checks,
      criteria: body.criteria,
    });
    return NextResponse.json(r.data, { status: r.ok ? 200 : r.status || 502 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "The eval service did not answer." }, { status: 502 });
  }
}
