import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const upgradeHeader = req.headers.get("upgrade");
  
  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  // This endpoint will be used to create a WebSocket proxy
  // For now, return instructions
  return new Response(
    JSON.stringify({
      error: "WebSocket upgrade needed",
      message: "Use a WebSocket client to connect to this endpoint"
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" }
    }
  );
}

