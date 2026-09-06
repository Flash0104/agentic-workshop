import OpenAI from "openai";
import {
  callNemotronChat,
  getNvidiaNemotronClient,
  getOpenAIVoiceClient,
} from "./llm-provider";

export { callNemotronChat, getNvidiaNemotronClient, getOpenAIVoiceClient };

// Exported for backward compatibility; points to OpenAI voice client
export const openai = getOpenAIVoiceClient().client;

export const DEFAULT_MODEL =
  process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";
export const TTS_MODEL =
  process.env.TTS_MODEL || "tts-1";
export const MAX_TURN_TOKENS = parseInt(
  process.env.MAX_TURN_TOKENS || "1024",
  10
);
export const MAX_OUTPUT_TOKENS = parseInt(
  process.env.MAX_OUTPUT_TOKENS || "1024",
  10
);
export const MAX_TURNS_PER_SESSION = parseInt(
  process.env.MAX_TURNS_PER_SESSION || "20",
  10
);

/**
 * Generate completion using NVIDIA Nemotron
 */
export async function generateChatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  temperature = 0.3
): Promise<string> {
  const result = await callNemotronChat({
    messages,
    temperature,
    maxTokens: MAX_OUTPUT_TOKENS,
  });
  return result.content;
}

/**
 * Speech-to-Text using OpenAI Whisper
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const { client } = getOpenAIVoiceClient();
  const extensionMap: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
  };

  const extension = extensionMap[mimeType] || "webm";
  const filename = `audio.${extension}`;

  const uint8Array = new Uint8Array(audioBuffer);
  const blob = new Blob([uint8Array], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  const transcription = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "en",
  });

  return transcription.text;
}

/**
 * Text-to-Speech using OpenAI TTS
 */
export async function generateSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "nova"
): Promise<Buffer> {
  const { client, ttsModel } = getOpenAIVoiceClient();
  const mp3Response = await client.audio.speech.create({
    model: ttsModel,
    voice,
    input: text,
  });

  const arrayBuffer = await mp3Response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
