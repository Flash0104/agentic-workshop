-- Migration: Add realtime interview fields
-- Run this in your Supabase SQL Editor

-- Add new columns to sessions table
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS job_description text,
ADD COLUMN IF NOT EXISTS cv_text text,
ADD COLUMN IF NOT EXISTS generated_questions jsonb;

-- Update existing sessions to have null values (they're already nullable)
-- No data migration needed as these are new fields

COMMENT ON COLUMN public.sessions.job_description IS 'Job description text provided by the user';
COMMENT ON COLUMN public.sessions.cv_text IS 'CV/Resume text extracted from uploaded document';
COMMENT ON COLUMN public.sessions.generated_questions IS 'Array of generated interview questions with focus areas';


