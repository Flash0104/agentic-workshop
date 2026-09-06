import OpenAI from "openai";

/**
 * Server-only LLM provider layer.
 * Strictly separates NVIDIA Nemotron (text reasoning, question gen, evaluation)
 * from OpenAI (Realtime voice, whisper STT, audio TTS).
 */

export interface LLMUsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface NemotronCompletionResult {
  content: string;
  provider: "nvidia";
  model: string;
  usage?: LLMUsageMetadata;
}

/**
 * Get configured NVIDIA Nemotron client.
 * Uses OpenAI-compatible API protocol with NVIDIA NIM base URL.
 */
export function getNvidiaNemotronClient(): { client: OpenAI; model: string } {
  const apiKey = process.env.NVIDIA_API_KEY || "";
  const baseURL =
    process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
  
  // Clean quotes and whitespace
  const rawModel = (process.env.NVIDIA_MODEL || "").trim().replace(/['"]/g, "");

  const ACTIVE_DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b";
  const DEPRECATED_MODELS = [
    "nvidia/nemotron-3-nano-30b-a3b",
    "nvidia/nemotron-nano-9b-v2",
    "nvidia/nvidia-nemotron-nano-9b-v2",
    "nvidia/nemotron-nano-3-30b-a3b",
  ];

  // Normalize retired/deprecated NIM aliases (HTTP 410 Gone)
  let model = rawModel || ACTIVE_DEFAULT_MODEL;
  if (!rawModel || DEPRECATED_MODELS.includes(rawModel) || rawModel.includes("nemotron-3-nano") || rawModel.includes("nano-9b")) {
    model = ACTIVE_DEFAULT_MODEL;
  }

  if (!apiKey) {
    console.warn(
      "⚠️ NVIDIA_API_KEY is not set. Nemotron calls will fail unless configured."
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: 65000, // 65 second timeout for complex Nemotron reasoning
    maxRetries: 2,
  });

  return { client, model };
}

/**
 * Get configured OpenAI client for voice / audio services only.
 */
export function getOpenAIVoiceClient(): { client: OpenAI; realtimeModel: string; ttsModel: string } {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const rawModel = (process.env.REALTIME_MODEL || process.env.NEXT_PUBLIC_REALTIME_MODEL || "").trim();
  const isValidRealtimeModel =
    rawModel.length >= 8 && (rawModel.startsWith("gpt-") || rawModel.includes("realtime"));
  const realtimeModel = isValidRealtimeModel ? rawModel : "gpt-realtime";
  const ttsModel = process.env.TTS_MODEL || "tts-1";

  const client = new OpenAI({
    apiKey,
    timeout: 30000,
    maxRetries: 2,
  });

  return { client, realtimeModel, ttsModel };
}

/**
 * Execute a completion against NVIDIA Nemotron with explicit error handling.
 */
export async function callNemotronChat(params: {
  messages: OpenAI.ChatCompletionMessageParam[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<NemotronCompletionResult> {
  const { client, model } = getNvidiaNemotronClient();

  if (!process.env.NVIDIA_API_KEY) {
    throw new Error(
      "NVIDIA_API_KEY is missing. Please set NVIDIA_API_KEY in your environment to use Nemotron."
    );
  }

  const completionParams: any = {
    model,
    messages: params.messages,
    temperature: params.temperature ?? 0.3,
    max_tokens: params.maxTokens ?? 2048,
  };

  if (params.jsonMode) {
    completionParams.response_format = { type: "json_object" };
    // Disable verbose chain-of-thought dump to prevent JSON cut-offs and timeout
    completionParams.chat_template_kwargs = { thinking: false };
  }

  try {
    const response = await client.chat.completions.create(completionParams);

    const content = response.choices[0]?.message?.content?.trim() || "";
    if (!content) {
      throw new Error("Empty response received from Nemotron model");
    }

    return {
      content,
      provider: "nvidia",
      model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error: any) {
    // Map known API errors
    if (error?.status === 401 || error?.status === 403) {
      throw new Error("NVIDIA API authentication failed. Verify your NVIDIA_API_KEY.");
    }
    if (error?.status === 429) {
      throw new Error("NVIDIA API rate limit exceeded. Please retry shortly.");
    }
    if (error?.status === 404 || error?.message?.includes("model")) {
      throw new Error(`NVIDIA model '${model}' is unavailable or not found.`);
    }
    throw error;
  }
}
