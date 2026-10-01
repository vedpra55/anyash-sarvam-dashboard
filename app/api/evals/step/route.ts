import { NextRequest, NextResponse } from "next/server";
import { callEvalAgent } from "@/lib/evalsServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Advances one scenario of a run by a few exchanges (and grades it when it ends). */
export async function POST(req: NextRequest) {
  const { resultId } = await req.json().catch(() => ({}));
  if (!resultId) return NextResponse.json({ error: "resultId is required" }, { status: 400 });
  try {
    const r = await callEvalAgent({ action: "step", result_id: resultId });
    return NextResponse.json(r.data, { status: r.ok ? 200 : r.status || 502 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "The eval service did not answer." }, { status: 502 });
  }
}
