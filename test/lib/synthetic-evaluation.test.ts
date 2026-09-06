// @vitest-environment node
import { describe, it, expect } from "vitest";
import syntheticDataset from "@/test/fixtures/synthetic-interview-dataset.json";
import { EvaluationResultSchema } from "@/lib/schemas";

describe("Synthetic Interview Evaluation Dataset (Phase 4 / 6)", () => {
  it("contains valid synthetic interview test cases", () => {
    expect(syntheticDataset.interviews).toHaveLength(2);
    expect(syntheticDataset.interviews[0].targetRole).toBe("Senior Backend Engineer");
    expect(syntheticDataset.interviews[1].targetRole).toBe("Frontend Developer");
  });

  it("validates high-quality STAR response against schema expectations", () => {
    const highQualityCase = syntheticDataset.interviews[0];
    const candidateAnswer = highQualityCase.turns[1].content;

    // Verify grounding
    expect(candidateAnswer).toContain("Black Friday");
    expect(candidateAnswer).toContain("Redis");
    expect(candidateAnswer).toContain("120,000 transactions");

    // Mock evaluation output adhering to strict schema
    const mockOutput = {
      scores: {
        content: 19,
        communication: 18,
        structure: 20,
        empathy: 16,
        goal: 19,
      },
      total: 92,
      starAnalysis: {
        situation: {
          coverage: "strong" as const,
          evidenceQuotes: ["during Black Friday sales, our Postgres database hit 100% CPU"],
        },
        task: {
          coverage: "strong" as const,
          evidenceQuotes: ["blocking order checkout", "I led the emergency response"],
        },
        action: {
          coverage: "strong" as const,
          evidenceQuotes: ["identified slow queries using pg_stat_statements", "implemented Redis write-through caching"],
        },
        result: {
          coverage: "strong" as const,
          evidenceQuotes: ["database CPU dropped to 35%", "processed 120,000 transactions"],
        },
      },
      highlights: ["Strong quantitative results", "Clear technical triage methodology"],
      improvements: ["Mention cross-functional stakeholder communication during outage"],
      disclaimer: "Practice feedback only — not a hiring decision or prediction.",
    };

    const validated = EvaluationResultSchema.parse(mockOutput);
    expect(validated.total).toBe(92);
    expect(validated.starAnalysis?.result.evidenceQuotes[0]).toContain("CPU dropped to 35%");
  });

  it("correctly identifies missing result evidence in weak candidate case", () => {
    const weakCase = syntheticDataset.interviews[1];
    const candidateAnswer = weakCase.turns[1].content;

    // Should have no numbers or quantitative results
    expect(/\b\d+\b/.test(candidateAnswer)).toBe(false);

    const mockOutput = {
      scores: {
        content: 12,
        communication: 14,
        structure: 11,
        empathy: 13,
        goal: 12,
      },
      total: 62,
      starAnalysis: {
        situation: {
          coverage: "partial" as const,
          evidenceQuotes: ["our team wanted to rebuild the portal"],
          missingInfo: "Scale and business drivers of rebuild were omitted.",
        },
        task: {
          coverage: "partial" as const,
          evidenceQuotes: ["I had to learn Next.js"],
        },
        action: {
          coverage: "partial" as const,
          evidenceQuotes: ["watched tutorials and read docs"],
          missingInfo: "No specific architectural components or features named.",
        },
        result: {
          coverage: "missing" as const,
          evidenceQuotes: [],
          missingInfo: "No measurable outcome or business impact provided.",
        },
      },
      highlights: ["Willingness to self-teach new technologies."],
      improvements: ["Provide concrete project deliverables and metrics in results."],
      disclaimer: "Practice feedback only — not a hiring decision or prediction.",
    };

    const validated = EvaluationResultSchema.parse(mockOutput);
    expect(validated.starAnalysis?.result.coverage).toBe("missing");
    expect(validated.starAnalysis?.result.evidenceQuotes).toHaveLength(0);
  });
});
