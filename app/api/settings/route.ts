import { NextRequest, NextResponse } from "next/server";
import { getSavedAgentVersion, saveAgentVersion } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const saved = await getSavedAgentVersion();
  const envVersion = Number(process.env.SARVAM_APP_VERSION) || null;

  return NextResponse.json({
    agent_version: saved ?? envVersion,
    source: saved ? "dashboard" : envVersion ? "env" : "none",
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const version = Number(body.agent_version);

    if (!Number.isInteger(version) || version < 1) {
      return NextResponse.json(
        { error: "Agent version must be a whole number of 1 or more" },
        { status: 400 }
      );
    }

    await saveAgentVersion(version);
    return NextResponse.json({ success: true, agent_version: version, source: "dashboard" });
  } catch (err: any) {
    console.error("Failed to save agent version:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save agent version" },
      { status: 500 }
    );
  }
}
