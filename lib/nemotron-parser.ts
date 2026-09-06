import { z } from "zod";
import { callNemotronChat, type NemotronCompletionResult } from "./llm-provider";
import type OpenAI from "openai";

/**
 * Extracts and cleans JSON string from raw model output.
 * Handles markdown code fences and extraneous preambles.
 */
export function extractJsonFromText(rawText: string): string {
  const trimmed = rawText.trim();

  // Code block with ```json ... ``` or ``` ... ```
  const codeBlockMatch =
    trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Look for first '{' or '[' to last '}' or ']'
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");

  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = trimmed.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = trimmed.lastIndexOf("]");
  }

  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.substring(start, end + 1);
  }

  return trimmed;
}

/**
 * Call NVIDIA Nemotron and validate its structured output with Zod.
 * Implements bounded retries (up to maxRetries) with error feedback to model.
 */
export async function callNemotronStructured<T>(params: {
  messages: OpenAI.ChatCompletionMessageParam[];
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
}): Promise<{
  data: T;
  raw: string;
  metadata: {
    provider: "nvidia";
    model: string;
    usage?: NemotronCompletionResult["usage"];
  };
}> {
  const maxRetries = params.maxRetries ?? 2;
  const conversation = [...params.messages];
  let lastError: Error | null = null;
  let lastRaw = "";
  let lastResult: NemotronCompletionResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await callNemotronChat({
        messages: conversation,
        temperature: params.temperature ?? 0.2,
        maxTokens: params.maxTokens ?? 1500,
        jsonMode: true,
      });

      lastResult = completion;
      lastRaw = completion.content;

      const cleanedJson = extractJsonFromText(completion.content);
      const parsed = JSON.parse(cleanedJson);

      // Support models that wrap arrays in root objects e.g. { "questions": [...] }
      let targetData = parsed;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if ("questions" in parsed && Array.isArray((parsed as any).questions)) {
          targetData = (parsed as any).questions;
        } else if ("data" in parsed && Array.isArray((parsed as any).data)) {
          targetData = (parsed as any).data;
        }
      }

      const validated = params.schema.parse(targetData);

      return {
        data: validated,
        raw: completion.content,
        metadata: {
          provider: "nvidia",
          model: completion.model,
          usage: completion.usage,
        },
      };
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        conversation.push({
          role: "assistant",
          content: lastRaw || "{}",
        });
        conversation.push({
          role: "user",
          content: `Your previous response failed validation with error: ${err.message}. Please respond with ONLY valid JSON strictly adhering to the requested schema.`,
        });
      }
    }
  }

  throw new Error(
    `Nemotron structured output failed after ${maxRetries + 1} attempts: ${lastError?.message}`
  );
}
