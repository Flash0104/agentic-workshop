// @vitest-environment node
import { describe, it, expect } from "vitest";
import { extractJsonFromText } from "@/lib/nemotron-parser";
import { EvaluationResultSchema, GeneratedQuestionsListSchema } from "@/lib/schemas";

describe("Nemotron Structured Parser (Phase 2)", () => {
  it("extracts pure JSON from markdown code blocks", () => {
    const markdown = "```json\n{\"question\":\"Tell me about a project\",\"focus\":\"Technical\"}\n```";
    const cleaned = extractJsonFromText(markdown);
    expect(JSON.parse(cleaned)).toEqual({
      question: "Tell me about a project",
      focus: "Technical",
    });
  });

  it("extracts JSON array from text with preamble and postamble", () => {
    const raw = "Here are the questions:\n[{\"question\":\"Describe a challenge\",\"focus\":\"Problem solving\"}]\nHope this helps!";
    const cleaned = extractJsonFromText(raw);
    const parsed = JSON.parse(cleaned);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].focus).toBe("Problem solving");
  });

  it("validates STAR evaluation schema with strict evidence fields", () => {
    const validSTARData = {
      scores: {
        content: 18,
        communication: 17,
        structure: 19,
        empathy: 16,
        goal: 18,
      },
      total: 88,
      starAnalysis: {
        situation: {
          coverage: "strong",
          evidenceQuotes: ["We faced a 30% drop in query latency during peak traffic."],
        },
        task: {
          coverage: "strong",
          evidenceQuotes: ["My role was leading the database migration."],
        },
        action: {
          coverage: "strong",
          evidenceQuotes: ["I implemented Redis caching and query indexing."],
        },
        result: {
          coverage: "strong",
          evidenceQuotes: ["Reduced latency by 45% with zero downtime."],
        },
      },
      highlights: ["Clear metrics and concrete ownership."],
      improvements: ["Mention team communication during the outage."],
      disclaimer: "Practice feedback only — not a hiring decision or prediction.",
    };

    const validated = EvaluationResultSchema.parse(validSTARData);
    expect(validated.total).toBe(88);
    expect(validated.starAnalysis?.result.coverage).toBe("strong");
  });

  it("rejects invalid STAR data missing required quotes", () => {
    const invalidData = {
      scores: { content: 15, communication: 15, structure: 15, empathy: 15, goal: 15 },
      total: 75,
      starAnalysis: {
        situation: {
          coverage: "invalid_status", // should be strong | partial | missing
          evidenceQuotes: "not an array",
        },
      },
      highlights: [],
      improvements: [],
    };

    expect(() => EvaluationResultSchema.parse(invalidData)).toThrow();
  });
});
