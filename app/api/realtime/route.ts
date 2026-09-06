import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: "active",
    protocol: "webrtc",
    sessionEndpoint: "/api/realtime/session",
    message:
      "OpenAI Realtime voice operates over WebRTC. Initiate sessions via POST /api/realtime/session.",
  });
}

export async function POST(req: NextRequest) {
  // Forward to /api/realtime/session logic
  return NextResponse.redirect(new URL("/api/realtime/session", req.url));
}
