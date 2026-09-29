import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const interactionId = searchParams.get("interaction_id");

    if (!interactionId || interactionId === "NO_INTERACTION_ID") {
      return new NextResponse("Recording not available", { status: 404 });
    }

    const apiKey = process.env.SARVAM_API_KEY || "";
    const orgId = process.env.SARVAM_ORG_ID || "";
    const workspaceId = process.env.SARVAM_WORKSPACE_ID || "";
    const appId = process.env.SARVAM_APP_ID || "";

    if (!apiKey || !orgId || !workspaceId || !appId) {
      return new NextResponse("Sarvam credentials missing", { status: 500 });
    }

    const recordingUrl = `https://apps.sarvam.ai/api/analytics/v1/${orgId}/${workspaceId}/${appId}/recordings/${encodeURIComponent(
      interactionId
    )}`;

    const sarvamRes = await fetch(recordingUrl, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey.trim(),
        "API-Subscription-Key": apiKey.trim(),
      },
    });

    if (!sarvamRes.ok) {
      return new NextResponse("Recording not found", { status: sarvamRes.status });
    }

    const contentType = sarvamRes.headers.get("content-type") || "audio/wav";
    const contentLength = sarvamRes.headers.get("content-length");

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=86400, immutable");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    return new NextResponse(sarvamRes.body as any, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error("Audio recording route error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
