# Behavioral Interview Practice Coach (NVIDIA Nemotron + OpenAI Realtime)

An AI-powered behavioral interview coach developed for the NVIDIA open-model project submission.

- **NVIDIA Nemotron** (`nvidia/nemotron-3.5-lightning-30b-a3b`): Powers personalized question generation, server-managed adaptive text interviewing with STAR probing, evidence-based evaluation, and answer comparison.
- **OpenAI Realtime API** (WebRTC via `client_secrets` & `calls`): Powers ultra-low latency live spoken conversations with browser microphone streaming and turn detection.

> **Provider Attribution:** Live spoken dialogue is powered by OpenAI Realtime over WebRTC. Question planning, conversational interview state transitions, STAR evidence scoring, and feedback generation are powered by NVIDIA Nemotron.

## ✨ Core Capabilities

- **📄 Profile & Job Context**: Ingests candidate CV and target job description with text/PDF parsing.
- **🤖 NVIDIA Nemotron Question Generation**: Produces 5 grounded behavioral interview questions tailored to the candidate's background and target role.
- **🔄 Adaptive Interview State Machine**: Server-managed state machine (`main_question` → `follow_up` → `next_question` → `completed`). Probes for missing Situation, Task, Action, or Result evidence with at most 2 follow-ups per main question.
- **🎙️ Live Voice Interview (WebRTC)**: Browser WebRTC connected via server-generated ephemeral credentials. Zero permanent keys exposed to the client.
- **📊 Evidence-Based STAR Evaluation**: Grounded analysis requiring verbatim transcript quotes. Scores are presented as practice feedback, not hiring predictions. No fabricated heuristics.
- **🔁 Answer Retry & Comparison**: Compare initial answers with revised answers using the same rubric to track quantifiable improvement.

## Architecture

```
[ Candidate Browser ]
   │
   ├─► [ POST /api/generate-questions ] ──► NVIDIA Nemotron (Personalized questions)
   │
   ├─► [ POST /api/chat ] (SSE Stream)  ──► NVIDIA Nemotron (Adaptive STAR state machine)
   │
   ├─► [ POST /api/realtime/session ]   ──► OpenAI Realtime (Ephemeral WebRTC credentials)
   │         │
   │         ▼ (Browser WebRTC PeerConnection)
   │   [ OpenAI Realtime Audio Server ] (Natural spoken dialogue)
   │
   ├─► [ POST /api/evaluate ]           ──► NVIDIA Nemotron (STAR evidence evaluation)
   │
   └─► [ Supabase PostgreSQL ]          ──► Sessions, turns, evaluations (JWT RLS authenticated)
```

## Quick Start

### Prerequisites

- Node.js 20+
- Supabase account & project
- NVIDIA API Key (`NVIDIA_API_KEY`) from [build.nvidia.com](https://build.nvidia.com)
- OpenAI API Key (`OPENAI_API_KEY`) for Realtime voice capabilities

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
## ⏱️ 60-Second Demo Outline

1. **0:00 - 0:10 | Setup & Profile Ingestion:**
   - Upload sample candidate resume (`Backend Engineer with 4 yrs experience`) and target job posting.
   - Click "Generate Questions". NVIDIA Nemotron parses the context and returns 5 grounded behavioral questions.
2. **0:10 - 0:25 | Adaptive Interview Probing:**
   - Candidate answers Question 1 with incomplete Result evidence ("I fixed the caching bug").
   - Nemotron's server state machine recognizes missing Result evidence and generates a targeted follow-up ("What was the measured impact on system latency?").
   - Candidate provides numbers ("Query latency reduced by 40%"). Nemotron acknowledges and advances to Question 2.
3. **0:25 - 0:40 | Live Spoken Voice (OpenAI Realtime WebRTC):**
   - Click "Start Voice Interview".
   - Candidate speaks into microphone. Browser WebRTC streams audio with sub-second turnaround and natural interruption handling.
4. **0:40 - 0:50 | Evidence-Based STAR Evaluation:**
   - Complete interview and click "Evaluate".
   - NVIDIA Nemotron analyzes the transcript, quotes candidate statements verbatim, scores Situation/Task/Action/Result coverage, and presents actionable practice feedback.
5. **0:50 - 1:00 | Answer Comparison & Retry:**
   - Candidate retries their answer to Question 1. Nemotron highlights specific improvements and calculates score delta.

## Troubleshooting

- **"Unauthorized" error**: Ensure you are logged in via Supabase Auth.
- **"NVIDIA API authentication failed"**: Set a valid `NVIDIA_API_KEY` from build.nvidia.com in `.env.local`.
- **"Evaluation temporarily unavailable"**: If the model experiences a rate limit or timeout, the transcript is preserved in Supabase and you can retry without losing progress. No fake heuristic scores are generated.

## License Notice

> [!WARNING]
> An explicit `LICENSE` file was not present in the original repository checkout. For submission to open-model contests or open-source distribution, adding a standard open-source license (e.g. Apache 2.0 or MIT) to the root directory is strongly recommended.

