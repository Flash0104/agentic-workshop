# Agentic Workshop Trainer

AI-powered conversational training platform for interview practice with **OpenAI Realtime API**, personalized question generation, and automated evaluation.

## ✨ New Features (v2.0)

- **📄 Easy Input**: Drag & drop PDF/TXT files or paste your CV and job description directly
- **🤖 AI Question Generation**: GPT-4o analyzes your profile and generates 5 targeted interview questions
- **🎙️ Realtime Voice Interview**: Ultra-low latency voice interaction using OpenAI Realtime API (gpt-4o-realtime-preview)
- **💬 Natural Conversations**: Sub-50ms latency, natural interruptions, and realistic interview flow
- **📊 Intelligent Evaluation**: Automated scoring and feedback based on your actual responses

## Features

- **Personalized Interview Training**: Upload CV + job description for custom questions
- **OpenAI Realtime API**: Native voice-to-voice with ~50ms latency (10x faster than traditional STT+TTS)
- **Document Parsing**: Support for PDF and TXT file formats
- **AI Question Generation**: GPT-4o creates role-specific interview questions
- **Smart Evaluation**: Comprehensive feedback on communication, technical skills, and fit
- **Session History**: Complete transcript, scores, and improvement suggestions
- **Modern UI**: Apple-inspired glassmorphism design

## Tech Stack

**Frontend**: Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui

**AI/Voice**: 
- OpenAI Realtime API (gpt-4o-realtime-preview) - Native voice-to-voice
- OpenAI GPT-4o - Question generation and evaluation
- OpenAI Whisper - Transcript generation

**Document Processing**: unpdf for lightweight PDF text extraction

**Backend**: Next.js API routes, Zod validation, WebSocket (Realtime API)

**Storage**: Supabase (Postgres + Auth + RLS + Realtime)

**Deployment**: Vercel (frontend), Supabase (database)

## Quick Start

### Prerequisites

- Node.js 20+
- Supabase account
- OpenAI API key

### Installation

1. Clone and install:
```bash
git clone <repo-url>
cd agentic-workshop
npm install
```

2. Configure environment:
```bash
cp .env.example .env.local
# Edit .env.local with your keys
```

3. Set up Supabase:
   - Create a new project at [supabase.com](https://supabase.com)
   - Run the SQL in `db/schema.sql` in the SQL editor
   - Run the SQL in `db/migration-realtime.sql` to add realtime features
   - Copy your project URL and anon key to `.env.local`

4. Run development servers:
   
**Option A - Run both servers together (recommended):**
```bash
npm run dev:full
```

**Option B - Run separately (better for debugging):**

Terminal 1 - WebSocket Proxy:
```bash
npm run proxy
```

Terminal 2 - Next.js:
```bash
npm run dev
```

**Note**: The WebSocket proxy (`ws://localhost:8080`) is required for the Realtime voice interview feature. It handles authentication with OpenAI's Realtime API since browsers can't send custom headers with WebSocket connections.

Open [http://localhost:3000](http://localhost:3000)

## How It Works

### Interview Flow

1. **Input Your Information**
   - Drag & drop a PDF/TXT file or paste your CV/resume content
   - Paste the job description you're applying for

2. **Question Generation**
   - GPT-4o analyzes both documents
   - Generates 5 personalized interview questions
   - Each question targets specific skills or experiences

3. **Realtime Voice Interview**
   - Connect to OpenAI Realtime API via WebSocket
   - Natural voice conversation with AI interviewer
   - Ultra-low latency (~50ms) for realistic interaction
   - Answer questions via voice or text

4. **Automated Evaluation**
   - Transcript analyzed by GPT-4o
   - Scored across multiple dimensions
   - Detailed feedback and improvement suggestions

5. **Results & Feedback**
   - View complete transcript
   - See scores visualization
   - Get personalized improvement tips

### Cost Estimation

**Per 5-minute interview session:**
- Question Generation (GPT-4o): ~$0.02
- Realtime Interview (gpt-4o-realtime-preview): ~$0.15
- Evaluation (GPT-4o): ~$0.03
- **Total: ~$0.20 per session**

**With $3 budget**: ~15 complete interview sessions

## Project Structure

```
agentic-workshop/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes (chat, stt, tts, evaluate, survey, sessions)
│   ├── sessions/[id]/        # Session detail page
│   └── page.tsx              # Home page
├── components/               # React components
│   ├── ChatPanel.tsx         # Chat interface
│   ├── VoiceRecorder.tsx     # Voice input
│   ├── ScoreRadar.tsx        # Evaluation visualization
│   ├── SurveyForm.tsx        # Acceptance survey
│   ├── SessionConfig.tsx     # Session configuration
│   └── ui/                   # shadcn/ui components
├── lib/                      # Core libraries
│   ├── supabase.ts           # Database client
│   ├── llm.ts                # OpenAI client + helpers
│   ├── prompts.ts            # System prompts
│   ├── schemas.ts            # Zod validation schemas
│   ├── scoring.ts            # Evaluation logic
│   └── db.ts                 # Database helpers
├── store/                    # Zustand state
│   └── useSessionStore.ts
└── db/                       # Database
    ├── schema.sql            # Table definitions + RLS
    └── seed.sql              # Sample data
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/sessions` | POST | Create new session |
| `/api/sessions` | GET | List user sessions |
| `/api/sessions/[id]` | GET | Get session details |
| `/api/sessions/[id]` | PATCH | End session |
| `/api/parse-document` | POST | Parse PDF/TXT to text |
| `/api/generate-questions` | POST | Generate personalized interview questions |
| `/api/chat` | POST | Send message, get AI reply (legacy) |
| `/api/stt` | POST | Transcribe audio (Whisper) |
| `/api/tts` | POST | Generate speech from text |
| `/api/evaluate` | POST | Run evaluation on session |
| `/api/survey` | POST | Submit acceptance survey |

## Database Schema

- **sessions**: User training sessions (mode, language, scenario, job_description, cv_text, generated_questions, timestamps)
- **turns**: Conversation messages (role, content, audio_url) - Used for transcript storage
- **evaluations**: AI-generated scores and reports (rubric, scores, highlights, improvements, report_markdown)
- **surveys**: User feedback (trust, usefulness, comfort, difficulty, reuse, free_text)

All tables use Row Level Security (RLS) to isolate user data.

## Environment Variables

See `.env.example` for all configuration options. Required:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-your-key
```

## Evaluation Rubric

Scores are 0-20 per dimension (total 0-100):

- **Content**: Factual accuracy, relevance, specificity
- **Communication**: Clarity, tone, fluency, professionalism
- **Structure**: Logical flow (intro → value → evidence → close)
- **Empathy**: Active listening, addressing concerns, rapport
- **Goal**: Achievement of session objective

## Acceptance Metrics

Computed from surveys:

- **Trust Score**: Mean trust rating
- **Satisfaction Index**: Mean of usefulness + comfort
- **Reuse Intention**: Mean reuse rating
- **Acceptance Rate**: % sessions with score ≥50 and satisfaction ≥3

## Development

```bash
# Run dev server
npm run dev

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

### Vercel (Frontend)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Supabase (Database)

Already deployed when you create the project. Just run the schema SQL.

## Cost Guardrails

- Max 1024 input tokens / 512 output tokens per turn
- Max 20 turns per session
- Audio limited to 30 seconds per recording
- TTS only for AI replies (no re-generation)

## Troubleshooting

**"Unauthorized" error**: Configure Supabase authentication or use the demo user in development

**No audio transcription**: Check microphone permissions and OpenAI API key

**Evaluation fails**: Fallback heuristic scoring will be used automatically

**RLS errors**: Verify you're logged in and row-level security policies are correct

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## License

MIT

## Support

Open an issue for bugs or feature requests.
