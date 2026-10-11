import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  DEFAULT_SESSION_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  verifyPasscode,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const passcode = typeof body?.passcode === "string" ? body.passcode.trim() : "";

  if (!passcode) {
    return NextResponse.json({ error: "Please enter your 5-character passcode" }, { status: 400 });
  }

  if (passcode.length !== 5) {
    return NextResponse.json({ error: "Passcode must be exactly 5 characters" }, { status: 400 });
  }

  const isValid = verifyPasscode(passcode);

  if (!isValid) {
    // Artificial small delay to slow down brute force attempts
    await new Promise((r) => setTimeout(r, 200));
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ success: true });

  const isProduction = process.env.NODE_ENV === "production";
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_SESSION_MAX_AGE_SECONDS,
  });

  return res;
}
