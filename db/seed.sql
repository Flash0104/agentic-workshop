-- Sample seed data for testing
-- Note: Replace the user_id with an actual user ID from your auth.users table

-- Example: Insert a test user ID (you need to replace this with a real user_id)
-- You can get a user_id by signing up a test user first, then checking auth.users

-- Sample session
-- INSERT INTO public.sessions (user_id, title, language, mode, scenario, created_at)
-- VALUES (
--   'YOUR-USER-UUID-HERE',
--   'Sample Interview Session',
--   'en',
--   'normal',
--   'interview',
--   now()
-- );

-- To use this:
-- 1. Create a user through Supabase Auth
-- 2. Get the user's UUID from the auth.users table
-- 3. Replace 'YOUR-USER-UUID-HERE' with that UUID
-- 4. Uncomment and run the above INSERT statement

-- For development, you can create a test user with:
-- Supabase Dashboard > Authentication > Users > Add User
-- Email: test@example.com, Password: test123456
