import { NextRequest, NextResponse } from "next/server";
import { getEvaluation, getSessionTurns, saveEvaluation } from "@/lib/db";
import { verifySessionOwnership, safeLogger } from "@/lib/auth-helpers";
import { callNemotronStructured } from "@/lib/nemotron-parser";
import { NEMOTRON_STAR_EVALUATION_PROMPT } from "@/lib/prompts";
import { EvaluateRequestSchema, EvaluationResultSchema } from "@/lib/schemas";
import { RUBRIC } from "@/lib/scoring";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = EvaluateRequestSchema.parse(body);

    const ownershipResult = await verifySessionOwnership(req, sessionId);
    if ("response" in ownershipResult) {
      return ownershipResult.response;
    }

    const { user, supabase, session } = ownershipResult;

    // Fetch conversation turns
    let turns = await getSessionTurns(sessionId, supabase);

    // Fallback: Check if session has saved transcript in transcript column or job_json
    if (!turns || turns.length === 0) {
      const fallbackRaw = (session as any)?.transcript || (session?.job_json as any)?.transcript;
      if (fallbackRaw) {
        try {
          const parsed = typeof fallbackRaw === "string" ? JSON.parse(fallbackRaw) : fallbackRaw;
          if (Array.isArray(parsed) && parsed.length > 0) {
            turns = parsed.map((t: any, idx: number) => ({
              id: idx + 1,
              session_id: sessionId,
              role: t.role === "assistant" ? "ai" : t.role || "user",
              content: t.content || "",
              created_at: t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString(),
              audio_url: null,
            })) as any;
          }
        } catch (parseErr) {
          safeLogger.warn("Failed to parse fallback transcript from session", { sessionId });
        }
      }
    }

    if (!turns || turns.length === 0) {
      return NextResponse.json(
        { error: "No interview turns recorded for evaluation. Please answer interview questions before evaluating." },
        { status: 400 }
      );
    }

    // Compute deterministic transcript hash to avoid stale cached evaluations
    const transcriptText = turns
      .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
      .join("\n\n");
    const transcriptHash = crypto
      .createHash("sha256")
      .update(transcriptText)
      .digest("hex");

    // Check if an up-to-date evaluation already exists for this exact transcript version
    const existingEval = await getEvaluation(sessionId, supabase);
    const existingHash = (existingEval?.rubric as Record<string, unknown>)?.transcriptHash;

    if (existingEval && existingHash === transcriptHash) {
      safeLogger.info("Serving up-to-date cached evaluation", {
        sessionId,
        transcriptHash,
      });

      return NextResponse.json({
        total: existingEval.total_score,
        scores: existingEval.scores,
        starAnalysis: (existingEval.rubric as any)?.starAnalysis,
        highlights: existingEval.highlights,
        improvements: existingEval.improvements,
        disclaimer: "Practice feedback only — not a hiring decision or prediction.",
        metadata: (existingEval.rubric as any)?.metadata || {
          provider: "nvidia",
          transcriptHash,
        },
      });
    }

    safeLogger.info("Evaluating interview with NVIDIA Nemotron", {
      sessionId,
      turnCount: turns.length,
      userId: user.id,
    });

    const jobContext = session.job_description
      ? `TARGET JOB DESCRIPTION:\n${session.job_description}\n\n`
      : "";

    const userPrompt = `${jobContext}INTERVIEW TRANSCRIPT:\n${transcriptText}`;

    // Call Nemotron for STAR evidence-based evaluation
    try {
      const evaluationResult = await callNemotronStructured({
        messages: [
          {
            role: "system",
            content: NEMOTRON_STAR_EVALUATION_PROMPT(session.language || "en"),
          },
          { role: "user", content: userPrompt },
        ],
        schema: EvaluationResultSchema,
        temperature: 0.2,
        maxTokens: 3000,
        maxRetries: 2,
      });

      const validated = evaluationResult.data;

      const metadata = {
        provider: evaluationResult.metadata.provider,
        model: evaluationResult.metadata.model,
        promptVersion: "star-nemotron-v1.0",
        evaluatedAt: new Date().toISOString(),
        transcriptHash,
        usage: evaluationResult.metadata.usage,
      };

      const enrichedResult = {
        ...validated,
        metadata,
      };

      // Generate markdown summary report
      const markdownReport = `# Behavioral Interview Evaluation Report
**Model:** ${metadata.model} (NVIDIA Nemotron)
**Date:** ${new Date().toLocaleDateString()}
**Overall Score:** ${validated.total}/100

> *Disclaimer: ${validated.disclaimer}*

## STAR Evidence Analysis
- **Situation:** ${validated.starAnalysis?.situation?.coverage.toUpperCase() || "N/A"}
  - *Evidence:* ${validated.starAnalysis?.situation?.evidenceQuotes?.join("; ") || "None"}
- **Task:** ${validated.starAnalysis?.task?.coverage.toUpperCase() || "N/A"}
  - *Evidence:* ${validated.starAnalysis?.task?.evidenceQuotes?.join("; ") || "None"}
- **Action:** ${validated.starAnalysis?.action?.coverage.toUpperCase() || "N/A"}
  - *Evidence:* ${validated.starAnalysis?.action?.evidenceQuotes?.join("; ") || "None"}
- **Result:** ${validated.starAnalysis?.result?.coverage.toUpperCase() || "N/A"}
  - *Evidence:* ${validated.starAnalysis?.result?.evidenceQuotes?.join("; ") || "None"}

## Key Strengths
${validated.highlights.map((h) => `- ${h}`).join("\n")}

## Targeted Practice Improvements
${validated.improvements.map((i) => `- ${i}`).join("\n")}
`;

      // Save evaluation in database with transcript hash and STAR analysis
      await saveEvaluation(
        sessionId,
        {
          rubric: {
            ...RUBRIC,
            transcriptHash,
            starAnalysis: validated.starAnalysis,
            metadata,
          },
          scores: validated.scores as Record<string, number>,
          totalScore: validated.total,
          highlights: validated.highlights,
          improvements: validated.improvements,
          reportMarkdown: markdownReport,
        },
        supabase
      );

      return NextResponse.json(enrichedResult);
    } catch (evalError: any) {
      safeLogger.error("Nemotron evaluation failed. Transcript preserved.", {
        sessionId,
        error: evalError?.message,
      });

      // Never fabricate heuristic scores. Keep transcript and offer retry!
      return NextResponse.json(
        {
          error:
            "AI evaluation service is temporarily unavailable or returned malformed output. Your interview transcript has been preserved. Please retry your evaluation.",
          transcriptPreserved: true,
          canRetry: true,
        },
        { status: 502 }
      );
    }
  } catch (error: any) {
    safeLogger.error("Evaluation route failure", { error: error?.message });
    return NextResponse.json(
      { error: error?.message || "Failed to process evaluation" },
      { status: 500 }
    );
  }
}
