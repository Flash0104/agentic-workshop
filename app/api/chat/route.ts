import { NextRequest, NextResponse } from "next/server";
import { verifySessionOwnership, safeLogger } from "@/lib/auth-helpers";
import { getNvidiaNemotronClient } from "@/lib/llm-provider";
import { getSessionTurns, saveTurn } from "@/lib/db";
import { NEMOTRON_ADAPTIVE_INTERVIEW_PROMPT } from "@/lib/prompts";
import {
  transitionInterview,
  type InterviewState,
  type InterviewQuestion,
  MAX_FOLLOW_UPS_PER_QUESTION,
} from "@/lib/interview-state-machine";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const { sessionId, message } = rawBody;

    if (!sessionId || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "sessionId and message are required" },
        { status: 400 }
      );
    }

    const ownershipResult = await verifySessionOwnership(req, sessionId);
    if ("response" in ownershipResult) {
      return ownershipResult.response;
    }

    const { user, supabase, session } = ownershipResult;

    const questions = (session.generated_questions || []) as InterviewQuestion[];
    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { error: "No interview questions found for this session" },
        { status: 400 }
      );
    }

    // Retrieve previous turns for context and duplicate detection
    const turns = await getSessionTurns(sessionId, supabase);

    // Duplicate submission protection
    const messageHash = crypto.createHash("md5").update(message.trim()).digest("hex");
    const lastTurn = turns[turns.length - 1];
    if (lastTurn && lastTurn.role === "user" && lastTurn.content.trim() === message.trim()) {
      return NextResponse.json(
        { error: "Duplicate submission detected. Please wait for the interviewer response." },
        { status: 409 }
      );
    }

    // Server-managed interview state
    const jobData = (session.job_json as Record<string, unknown>) || {};
    const currentState: InterviewState = (jobData.interviewState as InterviewState) || {
      currentQuestionIndex: 0,
      followUpCount: 0,
      status: "in_progress",
    };

    if (currentState.status === "completed" || session.ended_at) {
      return NextResponse.json({
        reply: "The interview is already completed. Thank you!",
        currentQuestionIndex: questions.length,
        followUpCount: 0,
        isComplete: true,
      });
    }

    // Evaluate evidence coverage to determine state transition
    const wordCount = message.trim().split(/\s+/).length;
    const hasNumbers = /\b\d{1,}\b/.test(message);
    const hasActionWords = /\b(built|implemented|created|designed|managed|led|resolved|improved|migrated|optimized)\b/i.test(message);

    // If answer is very brief (<35 words) or missing action/metrics, flag missing evidence
    const hasSufficientEvidence = wordCount >= 35 && hasActionWords && (hasNumbers || wordCount >= 60);
    const missingComponent = !hasActionWords ? "action" : !hasNumbers ? "result" : "situation";

    // Advance sequentially through the 5 preprocessed questions without follow-up interruptions
    const transition = transitionInterview({
      state: currentState,
      questions,
      userAnswer: message,
      evidenceEvaluation: {
        hasSufficientEvidence: true, // Always advance sequentially 1 -> 2 -> 3 -> 4 -> 5
      },
    });

    // Save user turn immediately
    await saveTurn(sessionId, "user", message.trim(), undefined, supabase);

    let cleanReply = "";

    if (transition.action === "finish_interview") {
      cleanReply =
        "Thank you very much for answering all 5 interview questions! All of your responses have been recorded. You can now view your comprehensive STAR evaluation report.";
    } else {
      const nextQNumber = transition.nextState.currentQuestionIndex + 1;
      const ackList = [
        "Thank you for sharing that experience.",
        "Understood, that gives great context on your approach.",
        "Thank you, that was very clear and detailed.",
        "Got it, thank you for sharing that background.",
        "Thank you for walking me through that project.",
      ];
      const ack = ackList[currentState.currentQuestionIndex % ackList.length];

      cleanReply = `${ack}\n\nQuestion ${nextQNumber} of ${questions.length}: ${transition.targetQuestionText}`;
    }

    // Server-Sent Events (SSE) Response Stream
    const encoder = new TextEncoder();
    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          // Stream words smoothly for natural typing effect
          const words = cleanReply.split(" ");
          for (let i = 0; i < words.length; i++) {
            const word = (i === 0 ? "" : " ") + words[i];
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "token", text: word })}\n\n`)
            );
            await new Promise((r) => setTimeout(r, 20));
          }

          // Persist AI response turn and state in database
          await saveTurn(sessionId, "ai", cleanReply, undefined, supabase);

          await supabase
            .from("sessions")
            .update({
              job_json: {
                ...jobData,
                interviewState: transition.nextState,
              },
              ended_at:
                transition.nextState.status === "completed"
                  ? new Date().toISOString()
                  : null,
            })
            .eq("id", sessionId);

          // Emit complete event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "complete",
                reply: cleanReply,
                currentQuestionIndex: transition.nextState.currentQuestionIndex,
                followUpCount: transition.nextState.followUpCount,
                isComplete: transition.nextState.status === "completed",
                action: transition.action,
              })}\n\n`
            )
          );

          controller.close();
        } catch (err: any) {
          safeLogger.error("Stream processing error", { error: err?.message });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: err?.message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(customReadable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    safeLogger.error("Chat API error", { error: error?.message });
    return NextResponse.json(
      { error: error?.message || "Failed to process interview response" },
      { status: 500 }
    );
  }
}
