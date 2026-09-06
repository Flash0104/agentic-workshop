// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getNvidiaNemotronClient,
  getOpenAIVoiceClient,
  callNemotronChat,
} from "@/lib/llm-provider";

describe("LLM Provider Layer (Phase 1)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("configures NVIDIA Nemotron client with customizable endpoint and model", () => {
    process.env.NVIDIA_API_KEY = "nvapi-test-key";
    process.env.NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
    process.env.NVIDIA_MODEL = "custom-nemotron-model";

    const { client, model } = getNvidiaNemotronClient();

    expect(client.baseURL).toBe("https://integrate.api.nvidia.com/v1");
    expect(client.apiKey).toBe("nvapi-test-key");
    expect(model).toBe("custom-nemotron-model");
  });

  it("normalizes deprecated NIM aliases that return HTTP 410 to active Nemotron 3.5 model", () => {
    process.env.NVIDIA_API_KEY = "nvapi-test-key-2";
    process.env.NVIDIA_MODEL = "nvidia/nemotron-3-nano-30b-a3b";

    const { model } = getNvidiaNemotronClient();
    expect(model).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
  });

  it("keeps voice configuration separate from text provider", () => {
    process.env.OPENAI_API_KEY = "sk-test-openai-key";
    process.env.REALTIME_MODEL = "gpt-realtime";
    process.env.TTS_MODEL = "tts-1";

    const voiceConfig = getOpenAIVoiceClient();
    expect(voiceConfig.realtimeModel).toBe("gpt-realtime");
    expect(voiceConfig.ttsModel).toBe("tts-1");
    expect(voiceConfig.client.apiKey).toBe("sk-test-openai-key");
  });

  it("throws a clear error when NVIDIA_API_KEY is missing", async () => {
    delete process.env.NVIDIA_API_KEY;

    await expect(
      callNemotronChat({
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow(/NVIDIA_API_KEY is missing/);
  });
});
