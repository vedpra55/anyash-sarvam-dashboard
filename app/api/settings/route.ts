import { NextRequest, NextResponse } from "next/server";
import { readSavedAgentVersion, saveAgentVersion } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const envVersion = Number(process.env.SARVAM_APP_VERSION) || null;

  try {
    const saved = await readSavedAgentVersion();
    return NextResponse.json(
      {
        agent_version: saved ?? envVersion,
        source: saved ? "dashboard" : envVersion ? "env" : "none",
      },
      { headers: NO_STORE }
    );
  } catch (err: any) {
    console.error("Failed to read agent version:", err);
    return NextResponse.json(
      {
        error: `Could not read saved agent version: ${err.message}`,
        agent_version: envVersion,
        source: envVersion ? "env" : "none",
      },
      { status: 500, headers: NO_STORE }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const version = Number(body.agent_version);

    if (!Number.isInteger(version) || version < 1) {
      return NextResponse.json(
        { error: "Agent version must be a whole number of 1 or more" },
        { status: 400, headers: NO_STORE }
      );
    }

    await saveAgentVersion(version);
    return NextResponse.json(
      { success: true, agent_version: version, source: "dashboard" },
      { headers: NO_STORE }
    );
  } catch (err: any) {
    console.error("Failed to save agent version:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save agent version" },
      { status: 500, headers: NO_STORE }
    );
  }
}
