import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSession } from "@/lib/db";
import type { Database } from "@/lib/supabase";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

export interface AuthenticatedContext {
  user: {
    id: string;
    email?: string;
  };
  token: string;
  supabase: any;
}

export interface SessionOwnershipContext extends AuthenticatedContext {
  session: SessionRow;
}

/**
 * Authenticate incoming request using Supabase JWT from Bearer header or cookie.
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<AuthenticatedContext | { response: NextResponse }> {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "") || "";

    const supabase = await createClient(token || undefined);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token || undefined);

    if (error || !user) {
      return {
        response: NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        ),
      };
    }

    return {
      user: { id: user.id, email: user.email },
      token,
      supabase,
    };
  } catch (err) {
    return {
      response: NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      ),
    };
  }
}

/**
 * Verify that the session exists, belongs to the authenticated user, and is not expired.
 */
export async function verifySessionOwnership(
  req: NextRequest,
  sessionId: string
): Promise<SessionOwnershipContext | { response: NextResponse }> {
  const authResult = await authenticateRequest(req);
  if ("response" in authResult) {
    return authResult;
  }

  const { user, token, supabase } = authResult;

  if (!sessionId || typeof sessionId !== "string") {
    return {
      response: NextResponse.json(
        { error: "Invalid or missing sessionId" },
        { status: 400 }
      ),
    };
  }

  const session = await getSession(sessionId, supabase);

  if (!session) {
    return {
      response: NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      ),
    };
  }

  if (session.user_id !== user.id) {
    return {
      response: NextResponse.json(
        { error: "Forbidden: You do not own this session" },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    token,
    supabase,
    session,
  };
}

/**
 * Validates request body size limit to avoid abuse / DoS.
 */
export function validatePayloadSize(
  bodyText: string,
  maxSizeBytes: number = 256 * 1024 // 256 KB default
): { valid: boolean; error?: string } {
  const size = Buffer.byteLength(bodyText, "utf8");
  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `Payload exceeds allowed size limit (${Math.round(size / 1024)}KB > ${Math.round(maxSizeBytes / 1024)}KB)`,
    };
  }
  return { valid: true };
}

/**
 * Safe logger that NEVER prints CVs, full transcripts, or credentials to server logs.
 */
export const safeLogger = {
  info: (tag: string, details?: Record<string, unknown>) => {
    console.log(`[INFO] ${tag}`, details ? sanitizeDetails(details) : "");
  },
  warn: (tag: string, details?: Record<string, unknown>) => {
    console.warn(`[WARN] ${tag}`, details ? sanitizeDetails(details) : "");
  },
  error: (tag: string, details?: Record<string, unknown>) => {
    console.error(`[ERROR] ${tag}`, details ? sanitizeDetails(details) : "");
  },
};

function sanitizeDetails(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("key") ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("authorization")
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (
      lowerKey.includes("cv") ||
      lowerKey.includes("resume") ||
      lowerKey.includes("transcript")
    ) {
      sanitized[key] = typeof val === "string" ? `[CONTENT_LENGTH:${val.length}]` : "[REDACTED_CONTENT]";
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}
