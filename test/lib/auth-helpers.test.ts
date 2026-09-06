import { describe, it, expect, vi } from "vitest";
import { validatePayloadSize, safeLogger } from "@/lib/auth-helpers";

describe("Auth and Security Helpers (Phase 1)", () => {
  it("validates payload size within allowed limits", () => {
    const smallPayload = JSON.stringify({ message: "Hello world" });
    const result = validatePayloadSize(smallPayload, 1024);
    expect(result.valid).toBe(true);
  });

  it("rejects oversized payload to prevent abuse / memory exhaustion", () => {
    const hugePayload = "x".repeat(2000);
    const result = validatePayloadSize(hugePayload, 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Payload exceeds allowed size limit");
  });

  it("sanitizes sensitive fields so CVs, transcripts and keys are never printed directly", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    safeLogger.info("Testing safe logger", {
      apiKey: "secret-key-123",
      authorization: "Bearer secret-token",
      cvText: "Candidate confidential CV details...",
      transcript: "Long interview transcript...",
      sessionId: "session-uuid-123",
    });

    expect(consoleSpy).toHaveBeenCalled();
    const loggedArgs = consoleSpy.mock.calls[0][1];
    expect(loggedArgs.apiKey).toBe("[REDACTED]");
    expect(loggedArgs.authorization).toBe("[REDACTED]");
    expect(loggedArgs.cvText).toContain("[CONTENT_LENGTH:");
    expect(loggedArgs.transcript).toContain("[CONTENT_LENGTH:");
    expect(loggedArgs.sessionId).toBe("session-uuid-123");

    consoleSpy.mockRestore();
  });
});
