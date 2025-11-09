import {
    getEvaluation,
    getSession,
    getSessionTurns,
    saveEvaluation,
} from "@/lib/db";
import { generateChatCompletion } from "@/lib/llm";
import { EVALUATOR_PROMPT } from "@/lib/prompts";
import { EvaluateRequestSchema, EvaluationResultSchema } from "@/lib/schemas";
import { RUBRIC, heuristicScore, parseEvaluationResponse } from "@/lib/scoring";
import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    const supabase = await createClient(token);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId } = EvaluateRequestSchema.parse(body);

    const session = await getSession(sessionId, supabase);
    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingEval = await getEvaluation(sessionId, supabase);
    if (existingEval) {
      return NextResponse.json({
        total: existingEval.total_score,
        scores: existingEval.scores,
        highlights: existingEval.highlights,
        improvements: existingEval.improvements,
      });
    }

    const turns = await getSessionTurns(sessionId, supabase);
    if (turns.length === 0) {
      return NextResponse.json(
        { error: "No conversation to evaluate" },
        { status: 400 }
      );
    }

    const transcript = turns
      .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
      .join("\n\n");

    try {
      const rawResponse = await generateChatCompletion(
        [
          { role: "system", content: EVALUATOR_PROMPT(session.language) },
          { role: "user", content: transcript },
        ],
        0.3
      );

      const { jsonBlock, markdownBlock } =
        parseEvaluationResponse(rawResponse);
      const evaluationData = JSON.parse(jsonBlock);
      const result = EvaluationResultSchema.parse(evaluationData);

      await saveEvaluation(sessionId, {
        rubric: RUBRIC,
        scores: result.scores,
        totalScore: result.total,
        highlights: result.highlights,
        improvements: result.improvements,
        reportMarkdown: markdownBlock,
      }, supabase);

      return NextResponse.json(result);
    } catch (parseError) {
      console.error("Failed to parse LLM evaluation, using fallback:", parseError);

      const fallbackTotal = heuristicScore(
        turns.map((t) => ({ role: t.role, content: t.content }))
      );
      const fallbackScores = {
        content: Math.round(fallbackTotal * 0.2),
        communication: Math.round(fallbackTotal * 0.2),
        structure: Math.round(fallbackTotal * 0.2),
        empathy: Math.round(fallbackTotal * 0.2),
        goal: Math.round(fallbackTotal * 0.2),
      };

      await saveEvaluation(sessionId, {
        rubric: RUBRIC,
        scores: fallbackScores,
        totalScore: fallbackTotal,
        highlights: ["Evaluation completed with fallback scoring"],
        improvements: ["Could not generate detailed feedback"],
        reportMarkdown:
          "# Evaluation Report\n\nFallback scoring applied due to processing error.",
      }, supabase);

      return NextResponse.json({
        scores: fallbackScores,
        total: fallbackTotal,
        highlights: ["Evaluation completed"],
        improvements: ["Continue practicing"],
      });
    }
  } catch (error) {
    console.error("Error in evaluation:", error);
    return NextResponse.json(
      { error: "Failed to evaluate session" },
      { status: 500 }
    );
  }
}




