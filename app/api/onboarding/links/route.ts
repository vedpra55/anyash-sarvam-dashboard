import { NextRequest, NextResponse } from "next/server";
import { createOnboardingToken } from "@/lib/parentStore";

export const dynamic = "force-dynamic";

/** Creates a single-use onboarding link for a child to fill on their phone. */
export async function POST(req: NextRequest) {
  try {
    const { token, expiresAt } = await createOnboardingToken();
    const base = process.env.APP_BASE_URL || req.nextUrl.origin;
    return NextResponse.json({ url: `${base.replace(/\/$/, "")}/onboard/${token}`, expiresAt });
  } catch (err: any) {
    console.error("Failed to create onboarding link:", err);
    return NextResponse.json({ error: err.message || "Couldn't create the link" }, { status: 500 });
  }
}
