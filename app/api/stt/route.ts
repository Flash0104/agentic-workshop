import { getSession, saveTurn } from "@/lib/db";
import { transcribeAudio } from "@/lib/llm";
import { STTRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB limit

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    const supabase = await createClient(token);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    
    console.log("STT auth:", { user: user?.email });
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const audio = formData.get("audio") as File;
    const sessionId = formData.get("sessionId") as string;
    const audioMime = formData.get("audioMime") as string;

    if (!audio || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    STTRequestSchema.parse({
      sessionId,
      chunkIndex: 0,
      audioMime: audioMime || "audio/webm",
    });

    const session = await getSession(sessionId, supabase);
    if (!session || session.user_id !== user.id) {
      console.log("STT Forbidden:", { session: !!session, user_id: session?.user_id, expected: user.id });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (audio.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: "Audio file too large (max 25MB)" },
        { status: 413 }
      );
    }

    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("Transcribing audio, size:", buffer.length);
    const text = await transcribeAudio(buffer, audio.type);
    console.log("Transcription result:", text);

    if (text.trim()) {
      console.log("Saving turn to database...");
      await saveTurn(sessionId, "user", text, undefined, supabase);
      console.log("Turn saved successfully");
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Error in STT:", error);
    console.error("Error details:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}




