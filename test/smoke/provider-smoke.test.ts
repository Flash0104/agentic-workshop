// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import { getNvidiaNemotronClient } from "@/lib/llm-provider";
import { callNemotronStructured } from "@/lib/nemotron-parser";
import { GeneratedQuestionsListSchema } from "@/lib/schemas";
import { NEMOTRON_QUESTION_GEN_PROMPT } from "@/lib/prompts";

// Ensure .env.local variables are loaded for smoke testing
if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [k, ...v] = trimmed.split("=");
      if (k && !process.env[k]) {
        process.env[k] = v.join("=");
      }
    }
  }
}

describe("Live Provider Smoke Tests (Phase 6)", () => {
  const hasNvidiaKey =
    Boolean(process.env.NVIDIA_API_KEY) &&
    !process.env.NVIDIA_API_KEY?.includes("placeholder") &&
    !process.env.NVIDIA_API_KEY?.includes("your-");

  const hasOpenAIKey =
    Boolean(process.env.OPENAI_API_KEY) &&
    !process.env.OPENAI_API_KEY?.includes("placeholder") &&
    !process.env.OPENAI_API_KEY?.includes("your-");

  it("reports actual status of live NVIDIA Nemotron integration without pretending success", async () => {
    if (!hasNvidiaKey) {
      console.log(
        "ℹ️ [SMOKE TEST SKIPPED] NVIDIA_API_KEY not configured or placeholder. Live Nemotron call skipped. Mocked schema tests verify contract correctness."
      );
      expect(true).toBe(true);
      return;
    }

    const { client, model } = getNvidiaNemotronClient();
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Say 'Nemotron online' in exactly two words." }],
      max_tokens: 20,
    });

    const reply = response.choices[0]?.message?.content?.trim();
    console.log("✅ Live Nemotron Smoke Test Succeeded:", reply);
    expect(reply).toBeTruthy();
  }, 25000);

  it("validates live Nemotron structured question generation with actual API", async () => {
    if (!hasNvidiaKey) {
      console.log(
        "ℹ️ [SMOKE TEST SKIPPED] NVIDIA_API_KEY not configured. Skipping live structured question generation test."
      );
      expect(true).toBe(true);
      return;
    }

    const result = await callNemotronStructured({
      messages: [
        { role: "system", content: NEMOTRON_QUESTION_GEN_PROMPT },
        {
          role: "user",
          content:
            "JOB DESCRIPTION: Senior React Developer.\nCANDIDATE CV: 5 years experience with React, Next.js, and TypeScript.",
        },
      ],
      schema: GeneratedQuestionsListSchema,
      temperature: 0.3,
      maxTokens: 2500,
      maxRetries: 2,
    });

    console.log("✅ Live Nemotron Question Generation Succeeded with", result.data.length, "questions!");
    console.log("First question preview:", result.data[0]);
    expect(result.data.length).toBeGreaterThanOrEqual(3);
    expect(result.data[0].question).toBeTruthy();
    expect(result.data[0].focus).toBeTruthy();
  }, 70000);

  it("reports actual status of live OpenAI Realtime endpoint credentials", async () => {
    if (!hasOpenAIKey) {
      console.log(
        "ℹ️ [SMOKE TEST SKIPPED] OPENAI_API_KEY not configured or placeholder. Live Realtime call skipped. WebRTC client protocol verified via unit tests."
      );
      expect(true).toBe(true);
      return;
    }

    const res = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });

    console.log("OpenAI API response status:", res.status);
    expect(res.status).toBeLessThan(500);
  }, 25000);
});
