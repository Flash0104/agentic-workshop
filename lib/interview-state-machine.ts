import { z } from "zod";

export interface InterviewQuestion {
  question: string;
  focus: string;
}

export interface InterviewState {
  currentQuestionIndex: number;
  followUpCount: number; // 0, 1, or 2
  status: "in_progress" | "completed";
  lastUserMessageHash?: string;
}

export const MAX_FOLLOW_UPS_PER_QUESTION = 2;

export interface TransitionInput {
  state: InterviewState;
  questions: InterviewQuestion[];
  userAnswer: string;
  evidenceEvaluation?: {
    hasSufficientEvidence: boolean;
    missingComponent?: "situation" | "task" | "action" | "result";
  };
}

export interface TransitionResult {
  nextState: InterviewState;
  action: "ask_follow_up" | "advance_question" | "finish_interview";
  targetQuestionText: string;
  targetFocus: string;
  missingEvidence?: string;
}

/**
 * Pure deterministic state machine for managing interview progression.
 * Follow-ups are capped at 2 per question.
 * Main question index does NOT increment on follow-ups.
 */
export function transitionInterview(input: TransitionInput): TransitionResult {
  const { state, questions, evidenceEvaluation } = input;

  if (state.status === "completed" || state.currentQuestionIndex >= questions.length) {
    return {
      nextState: {
        ...state,
        status: "completed",
      },
      action: "finish_interview",
      targetQuestionText: "The interview is complete. Thank you for your time.",
      targetFocus: "Closing",
    };
  }

  const currentQ = questions[state.currentQuestionIndex];
  const canFollowUp =
    state.followUpCount < MAX_FOLLOW_UPS_PER_QUESTION &&
    evidenceEvaluation &&
    !evidenceEvaluation.hasSufficientEvidence;

  if (canFollowUp) {
    // Remain on the same main question, increment follow-up count
    const nextState: InterviewState = {
      ...state,
      followUpCount: state.followUpCount + 1,
      status: "in_progress",
    };

    return {
      nextState,
      action: "ask_follow_up",
      targetQuestionText: currentQ.question,
      targetFocus: currentQ.focus,
      missingEvidence: evidenceEvaluation?.missingComponent,
    };
  }

  // Either answer has sufficient evidence or we reached the 2-follow-up ceiling
  const nextQuestionIndex = state.currentQuestionIndex + 1;
  const isComplete = nextQuestionIndex >= questions.length;

  if (isComplete) {
    const nextState: InterviewState = {
      currentQuestionIndex: nextQuestionIndex,
      followUpCount: 0,
      status: "completed",
    };

    return {
      nextState,
      action: "finish_interview",
      targetQuestionText: "Thank you. You have answered all questions. The interview is now complete.",
      targetFocus: "Closing",
    };
  }

  // Advance to next main question
  const nextQ = questions[nextQuestionIndex];
  const nextState: InterviewState = {
    currentQuestionIndex: nextQuestionIndex,
    followUpCount: 0,
    status: "in_progress",
  };

  return {
    nextState,
    action: "advance_question",
    targetQuestionText: nextQ.question,
    targetFocus: nextQ.focus,
  };
}
