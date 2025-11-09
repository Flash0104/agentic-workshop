import {
    endSession,
    getEvaluation,
    getSession,
    getSessionTurns,
    getSurvey,
} from "@/lib/db";
import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    const supabase = await createClient(token);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const [session, turns, evaluation, survey] = await Promise.all([
      getSession(id, supabase),
      getSessionTurns(id, supabase),
      getEvaluation(id, supabase),
      getSurvey(id, supabase),
    ]);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      session,
      turns,
      evaluation,
      survey,
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    const supabase = await createClient(token);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const session = await getSession(id, supabase);

    console.log("PATCH session check:", { 
      sessionId: id, 
      sessionExists: !!session, 
      sessionUserId: session?.user_id, 
      currentUserId: user.id,
      match: session?.user_id === user.id,
      updates: body
    });

    if (!session) {
      console.log("Session not found:", id);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      console.log("User mismatch:", { expected: session.user_id, got: user.id });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Save transcript as turns if provided
    if (body.transcript) {
      try {
        const transcript = JSON.parse(body.transcript);
        console.log("💾 Saving transcript with", transcript.length, "messages");
        
        // Insert each message as a turn
        const turns = transcript.map((msg: any) => ({
          session_id: id,
          role: msg.role === "assistant" ? "ai" : "user",
          content: msg.content,
          audio_url: null,
        }));

        const { error: turnsError } = await supabase
          .from("turns")
          .insert(turns);

        if (turnsError) {
          console.error("Error inserting turns:", turnsError);
          throw turnsError;
        }
      } catch (parseError) {
        console.error("Error parsing transcript:", parseError);
      }
    }

    // Mark session as ended
    const { error } = await supabase
      .from("sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Supabase update error:", error);
      throw error;
    }

    console.log("✅ Session ended successfully");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error ending session:", error);
    return NextResponse.json(
      { error: "Failed to end session" },
      { status: 500 }
    );
  }
}




