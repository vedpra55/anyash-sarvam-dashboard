import { NextRequest, NextResponse } from "next/server";
import { validateOnboarding } from "@/lib/onboarding";
import {
  claimToken,
  finishToken,
  getTokenState,
  releaseToken,
  saveOnboardingProfile,
  ProfileSaveError,
} from "@/lib/parentStore";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

const MESSAGES = {
  used: "This link has already been used. Ask the Anyash team for a new one if you need to change something.",
  expired: "This link has expired. Ask the Anyash team for a new one.",
  unknown: "This link isn't valid. Check that you opened the full link.",
} as const;

/** Whether the link can still be used. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const state = await getTokenState(token);
  return NextResponse.json(
    state === "valid" ? { state } : { state, error: MESSAGES[state] },
    { status: state === "valid" ? 200 : 410 },
  );
}

/** The child's form. The link is used up only when the profile is saved. */
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  const valid = validateOnboarding(body);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });

  const tokenId = await claimToken(token);
  if (!tokenId) {
    const state = await getTokenState(token);
    return NextResponse.json({ error: MESSAGES[state === "valid" ? "used" : state] }, { status: 410 });
  }

  try {
    const { parent } = await saveOnboardingProfile(valid.input, { kind: "public" });
    await finishToken(tokenId, parent.id);
    return NextResponse.json({ success: true, parentName: parent.parent_name }, { status: 201 });
  } catch (err: any) {
    await releaseToken(tokenId);
    const status = err instanceof ProfileSaveError ? err.status : 500;
    console.error("Onboarding submit failed:", err);
    return NextResponse.json(
      { error: status >= 500 ? "Something went wrong. Please try again." : err.message },
      { status },
    );
  }
}
