import { NextRequest, NextResponse } from "next/server";
import { verifySessionOwnership, safeLogger } from "@/lib/auth-helpers";
import { callNemotronStructured } from "@/lib/nemotron-parser";
import { NEMOTRON_COMPARE_ANSWERS_PROMPT } from "@/lib/prompts";
import {
  CompareAnswersRequestSchema,
  CompareAnswersResponseSchema,
} from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CompareAnswersRequestSchema.parse(body);

    const ownershipResult = await verifySessionOwnership(req, parsed.sessionId);
    if ("response" in ownershipResult) {
      return ownershipResult.response;
    }

    safeLogger.info("Comparing retried answer with Nemotron", {
      sessionId: parsed.sessionId,
    });

    const userPrompt = `QUESTION:
${parsed.questionText}

PREVIOUS ANSWER:
${parsed.previousAnswer}

NEW (RETRIED) ANSWER:
${parsed.newAnswer}`;

    const result = await callNemotronStructured({
      messages: [
        { role: "system", content: NEMOTRON_COMPARE_ANSWERS_PROMPT },
        { role: "user", content: userPrompt },
      ],
      schema: CompareAnswersResponseSchema,
      temperature: 0.2,
      maxTokens: 1000,
    });

    return NextResponse.json(result.data);
  } catch (error: any) {
    safeLogger.error("Answer comparison failed", { error: error?.message });
    return NextResponse.json(
      { error: error?.message || "Failed to compare answer attempts" },
      { status: 500 }
    );
  }
}
