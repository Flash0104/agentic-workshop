import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          language: "en" | "de";
          mode: "easy" | "normal" | "hard";
          scenario: "interview" | "sales";
          job_url: string | null;
          job_json: Record<string, unknown> | null;
          job_description: string | null;
          cv_text: string | null;
          generated_questions: { question: string; focus: string }[] | null;
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          language?: "en" | "de";
          mode: "easy" | "normal" | "hard";
          scenario?: "interview" | "sales";
          job_url?: string | null;
          job_json?: Record<string, unknown> | null;
          job_description?: string | null;
          cv_text?: string | null;
          generated_questions?: { question: string; focus: string }[] | null;
          created_at?: string;
          ended_at?: string | null;
        };
      };
      turns: {
        Row: {
          id: number;
          session_id: string;
          role: "user" | "ai" | "system";
          content: string;
          audio_url: string | null;
          created_at: string;
        };
        Insert: {
          session_id: string;
          role: "user" | "ai" | "system";
          content: string;
          audio_url?: string | null;
        };
      };
      evaluations: {
        Row: {
          id: number;
          session_id: string;
          rubric: Record<string, unknown>;
          scores: Record<string, number>;
          total_score: number;
          highlights: string[];
          improvements: string[];
          report_markdown: string;
          created_at: string;
        };
        Insert: {
          session_id: string;
          rubric: Record<string, unknown>;
          scores: Record<string, number>;
          total_score: number;
          highlights: string[];
          improvements: string[];
          report_markdown: string;
        };
      };
      surveys: {
        Row: {
          id: number;
          session_id: string;
          trust: number;
          usefulness: number;
          comfort: number;
          difficulty: number;
          reuse: number;
          free_text: string | null;
          created_at: string;
        };
        Insert: {
          session_id: string;
          trust: number;
          usefulness: number;
          comfort: number;
          difficulty: number;
          reuse: number;
          free_text?: string | null;
        };
      };
    };
  };
};

// Use fallback dummy values during build time to pass validation
// The actual values will be injected at runtime by Vercel
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder';

// Create the client (will only work at runtime with proper env vars)
// Type assertion ensures proper type inference even with fallback values
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey) as SupabaseClient<Database>;


