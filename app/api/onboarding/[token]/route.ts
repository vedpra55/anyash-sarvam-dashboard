import { NextRequest, NextResponse } from "next/server";
import { validateOnboarding } from "@/lib/onboarding";
import {
  claimToken,
  finishToken,
  getTokenState,
  releaseToken,
  saveOnboardingProfile,
  ProfileSaveError,
  TokenState,
} from "@/lib/parentStore";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

const MESSAGES: Record<Exclude<TokenState, "valid">, string> = {
  used: "This link has already been used, so your parent's details are saved. If something needs changing, let the person who sent you this link know.",
  expired: "This link has expired. Ask the person who sent it for a new one. It only takes them a moment.",
  revoked: "This link was turned off. Ask the person who sent it for a new one.",
  unknown: "We couldn't find this link. Check that you opened the full link from your message.",
};

const NO_STORE = { "Cache-Control": "no-store" };

/** Whether the link can still be used, and the friend's name to greet them by. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const { state, label } = await getTokenState(token);
  return NextResponse.json(
    state === "valid" ? { state, label } : { state, error: MESSAGES[state] },
    { status: state === "valid" ? 200 : 410, headers: NO_STORE },
  );
}

/** The friend's form. The link is used up only when the profile is saved. */
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "We couldn't read the form. Please try again." }, { status: 400 });
  }
  // The dashboard's routine editor isn't on the public form.
  if (body && typeof body === "object") delete body.other_routines;
  const valid = validateOnboarding(body);
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  // The public form always says which parent this is.
  if (!valid.input.parent_role) return NextResponse.json({ error: "Please choose Mom or Dad." }, { status: 400 });

  const tokenId = await claimToken(token);
  if (!tokenId) {
    const { state } = await getTokenState(token);
    return NextResponse.json({ state, error: MESSAGES[state === "valid" ? "used" : state] }, { status: 410 });
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
      {
        error: status >= 500 ? "Something went wrong on our side. Please try again in a moment." : err.message,
        field: status === 409 ? "phone_number" : undefined,
      },
      { status },
    );
  }
}
