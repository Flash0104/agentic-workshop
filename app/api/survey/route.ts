import { getSession, saveSurvey } from "@/lib/db";
import { SurveyRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const surveyData = SurveyRequestSchema.parse(body);

    const session = await getSession(surveyData.sessionId, supabase);
    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await saveSurvey(surveyData.sessionId, {
      trust: surveyData.trust,
      usefulness: surveyData.usefulness,
      comfort: surveyData.comfort,
      difficulty: surveyData.difficulty,
      reuse: surveyData.reuse,
      freeText: surveyData.freeText,
    }, supabase);

    return NextResponse.json(survey);
  } catch (error) {
    console.error("Error saving survey:", error);
    return NextResponse.json(
      { error: "Failed to save survey" },
      { status: 500 }
    );
  }
}




