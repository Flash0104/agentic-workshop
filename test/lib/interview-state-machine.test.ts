import { describe, it, expect } from "vitest";
import {
  transitionInterview,
  type InterviewState,
  type InterviewQuestion,
} from "@/lib/interview-state-machine";

describe("Interview State Machine (Phase 3)", () => {
  const mockQuestions: InterviewQuestion[] = [
    { question: "Tell me about a challenging bug.", focus: "Debugging" },
    { question: "Describe how you prioritize technical debt.", focus: "Prioritization" },
  ];

  it("triggers follow-up without advancing main question when STAR evidence is missing", () => {
    const initialState: InterviewState = {
      currentQuestionIndex: 0,
      followUpCount: 0,
      status: "in_progress",
    };

    const result = transitionInterview({
      state: initialState,
      questions: mockQuestions,
      userAnswer: "I found a bug and fixed it.",
      evidenceEvaluation: {
        hasSufficientEvidence: false,
        missingComponent: "result",
      },
    });

    expect(result.action).toBe("ask_follow_up");
    expect(result.nextState.currentQuestionIndex).toBe(0); // MUST stay at 0
    expect(result.nextState.followUpCount).toBe(1);
    expect(result.missingEvidence).toBe("result");
  });

  it("allows a second follow-up on the same question if evidence is still incomplete", () => {
    const stateWithOneFollowUp: InterviewState = {
      currentQuestionIndex: 0,
      followUpCount: 1,
      status: "in_progress",
    };

    const result = transitionInterview({
      state: stateWithOneFollowUp,
      questions: mockQuestions,
      userAnswer: "We deployed the fix to production.",
      evidenceEvaluation: {
        hasSufficientEvidence: false,
        missingComponent: "result",
      },
    });

    expect(result.action).toBe("ask_follow_up");
    expect(result.nextState.currentQuestionIndex).toBe(0);
    expect(result.nextState.followUpCount).toBe(2);
  });

  it("forces advance to next question after 2 follow-ups even if evidence is still missing", () => {
    const stateAtMaxFollowUps: InterviewState = {
      currentQuestionIndex: 0,
      followUpCount: 2,
      status: "in_progress",
    };

    const result = transitionInterview({
      state: stateAtMaxFollowUps,
      questions: mockQuestions,
      userAnswer: "Still no metrics available.",
      evidenceEvaluation: {
        hasSufficientEvidence: false,
        missingComponent: "result",
      },
    });

    expect(result.action).toBe("advance_question");
    expect(result.nextState.currentQuestionIndex).toBe(1); // Advanced to next question!
    expect(result.nextState.followUpCount).toBe(0);
    expect(result.targetQuestionText).toBe(mockQuestions[1].question);
  });

  it("advances immediately if candidate provides sufficient STAR evidence", () => {
    const initialState: InterviewState = {
      currentQuestionIndex: 0,
      followUpCount: 0,
      status: "in_progress",
    };

    const result = transitionInterview({
      state: initialState,
      questions: mockQuestions,
      userAnswer:
        "When our payment service crashed (S), I was tasked with lead triage (T). I implemented a fallback circuit breaker (A), restoring 99.9% uptime within 15 minutes (R).",
      evidenceEvaluation: {
        hasSufficientEvidence: true,
      },
    });

    expect(result.action).toBe("advance_question");
    expect(result.nextState.currentQuestionIndex).toBe(1);
    expect(result.nextState.followUpCount).toBe(0);
  });

  it("transitions to finish_interview when the final question is answered", () => {
    const stateAtFinalQuestion: InterviewState = {
      currentQuestionIndex: 1,
      followUpCount: 2,
      status: "in_progress",
    };

    const result = transitionInterview({
      state: stateAtFinalQuestion,
      questions: mockQuestions,
      userAnswer: "Final answer.",
      evidenceEvaluation: {
        hasSufficientEvidence: true,
      },
    });

    expect(result.action).toBe("finish_interview");
    expect(result.nextState.status).toBe("completed");
  });
});
