# Quick Start Guide

Get the Agentic Workshop Trainer running in 5 minutes.

## Prerequisites

- Node.js 20+
- OpenAI API key
- Supabase account (free tier works)

## 1. Install Dependencies

```bash
npm install
```

## 2. Environment Setup

```bash
# Copy the example env file
cp .env.example .env.local
```

Edit `.env.local` and add your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-key
OPENAI_API_KEY=sk-proj-...your-key
```

## 3. Set Up Database

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run the contents of `db/schema.sql`
3. Copy your project URL and anon key to `.env.local`

## 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Create a Test User

For authentication, create a test user in Supabase:

1. Go to Authentication → Users
2. Click "Add user" → "Create new user"
3. Email: `test@example.com`, Password: `test123456`

## 6. Test the App

1. Start a new session
2. Select scenario, difficulty, and language
3. Click "Start Session"
4. Type or record voice messages
5. End session and get AI evaluation

## Available Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Run production build

# Testing
npm run test         # Run unit tests (Vitest)
npm run test:ui      # Run tests with UI
npm run test:e2e     # Run E2E tests (Playwright)

# Code Quality
npm run lint         # Run linter
npx tsc --noEmit     # Type check
```

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- See [SETUP.md](./SETUP.md) for comprehensive setup instructions
- Customize prompts in `lib/prompts.ts`
- Adjust scoring in `lib/scoring.ts`

## Troubleshooting

**"Unauthorized" error**: Make sure you created a test user and configured Supabase auth

**No transcription**: Check your OpenAI API key and billing setup

**Build errors**: Run `npm install` again and check Node version (needs 20+)

Need more help? Check SETUP.md for detailed troubleshooting.

