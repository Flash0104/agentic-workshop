# Setup Guide

Complete setup instructions for the Agentic Workshop Trainer.

## 1. Prerequisites

Install these tools before starting:

- **Node.js** 20 or later ([nodejs.org](https://nodejs.org))
- **npm** (comes with Node.js)
- **Git** ([git-scm.com](https://git-scm.com))
- A code editor (VS Code recommended)

## 2. Clone Repository

```bash
git clone <your-repo-url>
cd agentic-workshop
npm install
```

## 3. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - Project name: `agentic-workshop`
   - Database password: (save this securely)
   - Region: (choose closest to you)
4. Click "Create new project"

### Run Database Schema

1. In your Supabase dashboard, click "SQL Editor"
2. Click "New query"
3. Copy entire contents of `db/schema.sql`
4. Paste and click "Run"
5. Verify tables created: Go to "Table Editor" and see `sessions`, `turns`, `evaluations`, `surveys`

### Get API Keys

1. Go to "Settings" → "API"
2. Copy:
   - Project URL (looks like `https://xxxxx.supabase.co`)
   - `anon` `public` key (starts with `eyJ...`)

## 4. OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Click your profile → "API keys"
4. Click "Create new secret key"
5. Copy the key (starts with `sk-...`)
6. Add payment method in "Billing" if not done yet

## 5. Environment Variables

Create `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase (paste your values)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (paste your key)
OPENAI_API_KEY=sk-proj-xxxxx...

# Optional - leave defaults
DEFAULT_MODEL=gpt-4o
TTS_MODEL=tts-1
MAX_TURN_TOKENS=1024
MAX_OUTPUT_TOKENS=512
MAX_TURNS_PER_SESSION=20
```

**Important**: Never commit `.env.local` to git!

## 6. Test Supabase Authentication

For development, you can use Supabase's built-in auth or test without authentication by temporarily disabling the auth check (not recommended for production).

### Option A: Enable Supabase Auth UI (Recommended)

Add authentication to your app:

1. In Supabase dashboard: "Authentication" → "Providers"
2. Enable "Email" provider
3. Optional: Enable Google/GitHub OAuth

Add a login page (or use Supabase's built-in login):

```typescript
// Simple login component (add to app if needed)
import { supabase } from '@/lib/supabase';

async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
}

async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
}
```

### Option B: Development Mode (Test User)

For quick testing, create a test user:

1. Supabase Dashboard → "Authentication" → "Users"
2. Click "Add user" → "Create new user"
3. Email: `test@example.com`, password: `test123456`
4. Click "Create user"

Then sign in with this user when testing.

## 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

You should see the Agentic Workshop Trainer home page!

## 8. Test the Application

### Test Session Creation

1. Click "Start Session"
2. Choose scenario (Interview or Sales)
3. Select difficulty and language
4. Click "Start Session"

**If you get "Unauthorized"**: You need to sign in with Supabase auth (see step 6)

### Test Voice Recording

1. Click the microphone icon
2. Allow browser microphone access
3. Speak for a few seconds
4. Click stop (red square)
5. Wait for transcription to appear

### Test Chat

1. Type a message in the input box
2. Press Enter or click Send
3. Wait for AI reply
4. Click speaker icon on AI message to hear TTS

### Test Evaluation

1. Have a conversation (at least 2-3 turns)
2. Click "End & Review Session"
3. Click "Evaluate Session"
4. Wait for AI evaluation (15-30 seconds)
5. See scores, radar chart, and report

### Test Survey

1. After evaluation completes
2. Fill out the 5 Likert scales
3. Optionally add free text
4. Click "Submit Survey"

## 9. Common Issues

### "Unauthorized" Error

**Problem**: Supabase auth not configured

**Solution**:
- Make sure you created a test user (step 6)
- Add sign-in functionality
- Or temporarily disable auth checks for development (not recommended)

### "Failed to transcribe audio"

**Problem**: OpenAI API key invalid or out of credits

**Solution**:
- Check `OPENAI_API_KEY` in `.env.local`
- Verify billing setup at platform.openai.com
- Check API usage limits

### "Failed to access microphone"

**Problem**: Browser permissions

**Solution**:
- Click lock icon in address bar
- Allow microphone access
- Refresh page and try again

### Build Errors

**Problem**: Missing dependencies or type errors

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
npx tsc --noEmit  # Check for type errors
```

### Database Connection Errors

**Problem**: Wrong Supabase URL or key

**Solution**:
- Double-check `.env.local` values
- Ensure no extra spaces or quotes
- Restart dev server after changing env vars

## 10. Deployment

### Vercel Deployment

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - (all other optional vars)
6. Click "Deploy"

Vercel will automatically:
- Build your Next.js app
- Deploy to a global CDN
- Provide a production URL

### Environment for Production

In Vercel dashboard → Settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
OPENAI_API_KEY = sk-proj-...
DEFAULT_MODEL = gpt-4o
TTS_MODEL = tts-1
MAX_TURN_TOKENS = 1024
MAX_OUTPUT_TOKENS = 512
MAX_TURNS_PER_SESSION = 20
```

## 11. Optional: Seed Data

If you want sample sessions for testing:

```bash
# Run seed script (after creating seed.sql)
# In Supabase SQL Editor, run db/seed.sql
```

## 12. Next Steps

- Customize prompts in `lib/prompts.ts`
- Adjust scoring rubric in `lib/scoring.ts`
- Add more training scenarios
- Implement job description parsing
- Add analytics dashboard
- Set up CI/CD with GitHub Actions

## Need Help?

- Check the main README.md
- Review error logs in browser console
- Check Supabase logs in dashboard
- Open an issue on GitHub

Happy training! 🚀
