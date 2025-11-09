import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const DEFAULT_MODEL =
  (process.env.DEFAULT_MODEL as string) || "gpt-4o";
export const TTS_MODEL =
  (process.env.TTS_MODEL as string) || "gpt-4o-audio-preview";
export const MAX_TURN_TOKENS = parseInt(
  process.env.MAX_TURN_TOKENS || "1024",
  10
);
export const MAX_OUTPUT_TOKENS = parseInt(
  process.env.MAX_OUTPUT_TOKENS || "512",
  10
);
export const MAX_TURNS_PER_SESSION = parseInt(
  process.env.MAX_TURNS_PER_SESSION || "20",
  10
);

export async function generateChatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  temperature = 0.7
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    temperature,
    max_tokens: MAX_OUTPUT_TOKENS,
  });

  return completion.choices[0]?.message?.content ?? "";
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string
): Promise<string> {
  // Map MIME type to file extension for OpenAI
  const extensionMap: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
  };
  
  const extension = extensionMap[mimeType] || "webm";
  const filename = `audio.${extension}`;

  // Convert buffer to File-like object for OpenAI
  // First create a Blob from the buffer, then convert to File
  const blob = new Blob([audioBuffer.buffer], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "en", // Could be dynamic based on session
  });

  return transcription.text;
}

export async function generateSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "nova"
): Promise<Buffer> {
  const mp3Response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
  });

  const arrayBuffer = await mp3Response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}




