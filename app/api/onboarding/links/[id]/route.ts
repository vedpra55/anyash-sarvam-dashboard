import { NextRequest, NextResponse } from "next/server";
import { revokeOnboardingLink } from "@/lib/parentStore";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Turns off a link that hasn't been filled yet. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  try {
    const done = await revokeOnboardingLink(id);
    if (!done) {
      return NextResponse.json({ error: "This link was already filled or turned off." }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to turn off onboarding link:", err);
    return NextResponse.json({ error: err.message || "Couldn't turn off the link" }, { status: 500 });
  }
}
