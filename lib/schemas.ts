import { z } from "zod";

// Core message schema
export const MessageSchema = z.object({
  role: z.enum(["system", "user", "ai", "assistant"]),
  content: z.string().min(1),
});

export type Message = z.infer<typeof MessageSchema>;

// API Request Schemas
export const ChatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  messages: z.array(MessageSchema),
  mode: z.enum(["easy", "normal", "hard"]),
  language: z.enum(["en", "de"]).default("en"),
  scenario: z.enum(["interview", "sales"]).default("interview"),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const STTRequestSchema = z.object({
  sessionId: z.string().uuid(),
  chunkIndex: z.number().int().min(0),
  audioMime: z.enum(["audio/webm", "audio/mpeg", "audio/wav", "audio/ogg"]),
});

export type STTRequest = z.infer<typeof STTRequestSchema>;

export const TTSRequestSchema = z.object({
  text: z.string().min(1).max(4096),
  language: z.enum(["en", "de"]).default("en"),
});

export type TTSRequest = z.infer<typeof TTSRequestSchema>;

export const EvaluateRequestSchema = z.object({
  sessionId: z.string().uuid(),
});

export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

export const SurveyRequestSchema = z.object({
  sessionId: z.string().uuid(),
  trust: z.number().int().min(1).max(5),
  usefulness: z.number().int().min(1).max(5),
  comfort: z.number().int().min(1).max(5),
  difficulty: z.number().int().min(1).max(5),
  reuse: z.number().int().min(1).max(5),
  freeText: z.string().optional(),
});

export type SurveyRequest = z.infer<typeof SurveyRequestSchema>;

export const CreateSessionSchema = z.object({
  title: z.string().optional(),
  language: z.enum(["en", "de"]).default("en"),
  mode: z.enum(["easy", "normal", "hard"]),
  scenario: z.enum(["interview", "sales"]).default("interview"),
  jobUrl: z.string().url().optional(),
  jobJson: z.record(z.string(), z.unknown()).optional(),
});

export type CreateSession = z.infer<typeof CreateSessionSchema>;

// Generated question schema
export const GeneratedQuestionSchema = z.object({
  question: z.string().min(5),
  focus: z.string().min(3),
});

export const GeneratedQuestionsListSchema = z.array(GeneratedQuestionSchema).min(1).max(10);
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

// Evaluation result schema
export const EvaluationScoresSchema = z.object({
  content: z.number().min(0).max(20),
  communication: z.number().min(0).max(20),
  structure: z.number().min(0).max(20),
  empathy: z.number().min(0).max(20),
  goal: z.number().min(0).max(20),
});

export type EvaluationScores = z.infer<typeof EvaluationScoresSchema>;

// STAR evidence component schema
export const STARComponentSchema = z.object({
  coverage: z.enum(["strong", "partial", "missing"]),
  evidenceQuotes: z.array(z.string()),
  missingInfo: z.string().optional(),
});

export const STARAnalysisSchema = z.object({
  situation: STARComponentSchema,
  task: STARComponentSchema,
  action: STARComponentSchema,
  result: STARComponentSchema,
});

export type STARAnalysis = z.infer<typeof STARAnalysisSchema>;

export const EvaluationResultSchema = z.object({
  scores: EvaluationScoresSchema,
  total: z.number().min(0).max(100),
  starAnalysis: STARAnalysisSchema.optional(),
  highlights: z.array(z.string()),
  improvements: z.array(z.string()),
  disclaimer: z.string().default("Practice feedback only — not a hiring decision or prediction."),
  metadata: z.object({
    provider: z.string(),
    model: z.string(),
    promptVersion: z.string(),
    evaluatedAt: z.string(),
    transcriptHash: z.string().optional(),
    usage: z.object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    }).optional(),
  }).optional(),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// Retry Answer comparison schema
export const CompareAnswersRequestSchema = z.object({
  sessionId: z.string().uuid(),
  questionText: z.string().min(1),
  previousAnswer: z.string().min(1),
  newAnswer: z.string().min(1),
});

export const CompareAnswersResponseSchema = z.object({
  improvementsDetected: z.array(z.string()),
  remainingGaps: z.array(z.string()),
  scoreDelta: z.number(),
  feedback: z.string(),
});








