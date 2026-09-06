// @vitest-environment node
import { describe, it, expect } from "vitest";
import crypto from "crypto";

describe("Stale Evaluation Prevention & Transcript Hashing (Phase 4)", () => {
  function computeTranscriptHash(turns: Array<{ role: string; content: string }>): string {
    const transcriptText = turns
      .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
      .join("\n\n");
    return crypto.createHash("sha256").update(transcriptText).digest("hex");
  }

  it("produces identical hash for identical transcript", () => {
    const turns = [
      { role: "user", content: "I built a cache system." },
      { role: "ai", content: "What were the results?" },
      { role: "user", content: "Reduced latency by 40%." },
    ];

    const hash1 = computeTranscriptHash(turns);
    const hash2 = computeTranscriptHash([...turns]);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("detects transcript modifications and changes hash to invalidate stale cached evaluations", () => {
    const initialTurns = [
      { role: "user", content: "Initial answer without metrics." },
    ];
    const initialHash = computeTranscriptHash(initialTurns);

    // Candidate adds a retry answer or follow-up response
    const updatedTurns = [
      ...initialTurns,
      { role: "ai", content: "Can you provide quantitative metrics?" },
      { role: "user", content: "Yes, we achieved 99.9% uptime and $50k monthly savings." },
    ];
    const updatedHash = computeTranscriptHash(updatedTurns);

    expect(updatedHash).not.toBe(initialHash);
  });
});
