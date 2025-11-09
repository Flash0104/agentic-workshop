import type { CreateSession } from "./schemas";
import { supabase, type Database } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type Turn = Database["public"]["Tables"]["turns"]["Row"];
type Evaluation = Database["public"]["Tables"]["evaluations"]["Row"];
type Survey = Database["public"]["Tables"]["surveys"]["Row"];

export async function createSession(
  userId: string,
  data: CreateSession,
  supabaseClient?: SupabaseClient<Database>
): Promise<Session> {
  const client = supabaseClient || supabase;
  const { data: session, error } = await client
    .from("sessions")
    .insert({
      user_id: userId,
      title: data.title,
      language: data.language,
      mode: data.mode,
      scenario: data.scenario,
      job_url: data.jobUrl,
      job_json: data.jobJson,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating session:", error);
    throw error;
  }
  return session;
}

export async function getSession(
  sessionId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<Session | null> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) return null;
  return data;
}

export async function getUserSessions(
  userId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<Session[]> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function endSession(
  sessionId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<void> {
  const client = supabaseClient || supabase;
  const { error } = await client
    .from("sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function saveTurn(
  sessionId: string,
  role: "user" | "ai" | "system",
  content: string,
  audioUrl?: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<Turn> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("turns")
    .insert({
      session_id: sessionId,
      role,
      content,
      audio_url: audioUrl,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSessionTurns(
  sessionId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<Turn[]> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("turns")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function saveEvaluation(
  sessionId: string,
  evaluation: {
    rubric: Record<string, unknown>;
    scores: Record<string, number>;
    totalScore: number;
    highlights: string[];
    improvements: string[];
    reportMarkdown: string;
  },
  supabaseClient?: SupabaseClient<Database>
): Promise<Evaluation> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("evaluations")
    .insert({
      session_id: sessionId,
      rubric: evaluation.rubric,
      scores: evaluation.scores,
      total_score: evaluation.totalScore,
      highlights: evaluation.highlights,
      improvements: evaluation.improvements,
      report_markdown: evaluation.reportMarkdown,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getEvaluation(
  sessionId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<Evaluation | null> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("evaluations")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error) return null;
  return data;
}

export async function saveSurvey(
  sessionId: string,
  survey: {
    trust: number;
    usefulness: number;
    comfort: number;
    difficulty: number;
    reuse: number;
    freeText?: string;
  },
  supabaseClient?: SupabaseClient<Database>
): Promise<Survey> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("surveys")
    .insert({
      session_id: sessionId,
      trust: survey.trust,
      usefulness: survey.usefulness,
      comfort: survey.comfort,
      difficulty: survey.difficulty,
      reuse: survey.reuse,
      free_text: survey.freeText,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSurvey(
  sessionId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<Survey | null> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("surveys")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error) return null;
  return data;
}




