import { NextRequest, NextResponse } from "next/server";
import { createOnboardingToken, listOnboardingLinks } from "@/lib/parentStore";
import { cleanLinkDays, cleanLinkLabel } from "@/lib/onboardingLinks";

export const dynamic = "force-dynamic";

/** The recent invite links and where each one stands. */
export async function GET() {
  try {
    return NextResponse.json({ links: await listOnboardingLinks() });
  } catch (err: any) {
    console.error("Failed to list onboarding links:", err);
    return NextResponse.json({ error: err.message || "Couldn't load the links" }, { status: 500 });
  }
}

/** Creates a single-use invite link for a friend to fill on their phone. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const label = cleanLinkLabel(body?.label);
  try {
    const { id, token, expiresAt } = await createOnboardingToken({ label, days: cleanLinkDays(body?.days) });
    const base = process.env.APP_BASE_URL || req.nextUrl.origin;
    return NextResponse.json({ id, label, url: `${base.replace(/\/$/, "")}/onboard/${token}`, expiresAt });
  } catch (err: any) {
    console.error("Failed to create onboarding link:", err);
    return NextResponse.json({ error: err.message || "Couldn't create the link" }, { status: 500 });
  }
}
