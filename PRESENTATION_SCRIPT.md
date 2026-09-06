# NVIDIA Golden Ticket Developer Contest (GTC Berlin)
## Technical Video Presentation Script & Demo Playbook

> **Contest Target**: NVIDIA GTC Berlin Golden Ticket Developer Contest  
> **Project**: NVIDIA Nemotron Behavioral Interview & Voice Coach  
> **Repository**: [https://github.com/Flash0104/agentic-workshop](https://github.com/Flash0104/agentic-workshop)  
> **Live App**: Deployed on Vercel  

---

### 1. The One-Line "Why" (The Problem It Solves)
> **"Generic interview preparation fails because practice bots ask cliché questions and give arbitrary scores; our coach uses NVIDIA's open Nemotron reasoning model to extract true requirements from the candidate's CV and target job description, conducts a structured STAR interview, and computes verifiable, quote-grounded behavioral evaluations."**

---

### 2. The Tech Stack & Why We Picked It

| Component | Technology | Why We Picked It |
| :--- | :--- | :--- |
| **Open Foundation Model** | **NVIDIA Nemotron 3.5 Lightning (`nvidia/nemotron-3.5-lightning-30b-a3b`)** via NVIDIA NIM | State-of-the-art open reasoning model. Excels at complex CV-to-job matching, generating targeted STAR questions, and synthesizing transcript evidence without hallucinating scores. |
| **Realtime Voice Engine** | **OpenAI Realtime API (GA WebRTC)** | Direct browser-to-cloud WebRTC audio streams via ephemeral tokens (`/v1/realtime/client_secrets` & `/v1/realtime/calls`) for ultra-low latency conversational speech with server VAD. |
| **Frontend & Backend Framework** | **Next.js 16 (App Router + Turbopack)** | Server-Sent Events (SSE) streaming, server-only API separation, and blazingly fast client rendering. |
| **Database & Auth** | **Supabase (PostgreSQL + RLS + JWT)** | Real-time session management, secure turn persistence, and encrypted session ownership. |
| **Client Audio & Speech** | **Web Speech API + OpenAI TTS (`alloy`)** | Resilient browser speech transcription with continuous auto-reconnect fallback so candidate answers are never lost. |
| **Export & Reporting** | **jsPDF + ScoreRadar** | One-click candidate performance overview, 5-dimension radar breakdown, and branded PDF download. |

---

### 3. 60-90 Second Video Recording Script (Beat-by-Beat)

*(Record your screen on [http://localhost:3000](http://localhost:3000) or your Vercel URL with your microphone active)*

#### [0:00 - 0:12] The Hook & CV Grounding
- **Screen**: Start on the home screen (`/`). Drag and drop a sample CV or paste your CV text and paste a real software engineer Job Description.
- **Voiceover**: 
  > *"Hi everyone! Preparing for behavioral interviews is tough because generic tools ask generic questions. Here is our AI Interview Coach powered by NVIDIA's open model, Nemotron 3.5 Lightning. Let's upload a CV and a target Job Description and generate our session."*
- **Action**: Click **"Analyze & Generate Interview Questions"**.

#### [0:12 - 0:25] Open Model Question Generation (Nemotron NIM)
- **Screen**: Show the 5 personalized STAR questions appearing on screen with their targeted focus tags.
- **Voiceover**: 
  > *"Instead of canned questions, Nemotron analyzes the real technical overlap between my background and the job requirements, producing five targeted STAR behavioral questions covering architecture, technical trade-offs, and production troubleshooting."*

#### [0:25 - 0:50] The Live Interview (Voice + Continuous Speech Workspace)
- **Screen**: Click **"Start Interview"**. The AI speaks Question 1 aloud. Click the mic, speak your response (or let the audio transcribe into the live workspace with the word counter), then click **"Submit Answer"**. Show Question 2 appearing smoothly.
- **Voiceover**: 
  > *"We support both low-latency OpenAI Realtime WebRTC voice and continuous speech recognition. Candidates can speak naturally into their mic, verify their words in real time, and submit. The interviewer advances seamlessly from question 1 to 5 without interruptions or prompt leaks."*

#### [0:50 - 1:15] Deep STAR Evaluation & Verifiable Scores (Nemotron NIM)
- **Screen**: Complete the interview and navigate to the `/sessions/[id]` results screen. Show the Score Radar, the 100-point total score, the 5 rubric dimensions, and the verbatim quotes in the Highlights. Click **"Export PDF"** to demonstrate the downloaded report.
- **Voiceover**: 
  > *"Once finished, Nemotron evaluates the complete interview transcript against the STAR methodology. It scores Content, Communication, Structure, Empathy, and Goals. Crucially, it doesn't hallucinate: every single highlight is backed by an exact quote from my actual answers. And with one click, candidates can export a complete PDF debrief."*

#### [1:15 - 1:25] Closing & Contest Wrap-Up
- **Screen**: Show GitHub repository ([https://github.com/Flash0104/agentic-workshop](https://github.com/Flash0104/agentic-workshop)) and architecture badge.
- **Voiceover**: 
  > *"Built with open models, deployed live, and ready to ship. See you at GTC Berlin!"*

---

### 4. Technical Architectural Strengths (Judge Cheatsheet)

1. **Strict Provider Separation**:
   - `lib/llm-provider.ts` strictly enforces separation: NVIDIA Nemotron handles all reasoning, question synthesis, and evidence evaluation; OpenAI handles audio modalities (Realtime WebRTC / TTS).
2. **Zero-Hallucination Evidence Grounding**:
   - `lib/prompts.ts` enforces that every score claim in `NEMOTRON_STAR_EVALUATION_PROMPT` must contain exact verbatim quotes from the interview transcript. No fabricated metrics or inflated ratings.
3. **OpenAI Realtime GA Compliance**:
   - Fully migrated to OpenAI's GA Realtime architecture using `/v1/realtime/client_secrets` and browser WebRTC negotiation via `/v1/realtime/calls`.
4. **Optimized Token & Latency Budget**:
   - Implemented `chat_template_kwargs: { thinking: false }` for structured JSON output, reducing evaluation latency from 2.4 minutes down to under 20 seconds.
5. **Deterministic State Machine**:
   - `lib/interview-state-machine.ts` guarantees sequential question pacing without leaked model preambles.

---

### 5. Ready-to-Post Social Media Template (LinkedIn / X)

Copy and customize this text when submitting your video:

```markdown
🚀 Excited to showcase my submission for the NVIDIA Golden Ticket Developer Contest for #NVIDIAGTC Berlin!

I built an end-to-end Behavioral Interview Coach powered by NVIDIA's open foundation model: Nemotron 3.5 Lightning (via NVIDIA NIM).

💡 The Problem:
Generic practice bots ask cliché questions and give arbitrary scores that don't help engineers grow. 

🛠️ How It Works:
1. Grounded Question Generation: Nemotron extracts real technical requirements from your CV and target Job Description to craft 5 personalized STAR questions.
2. Live Spoken Interview: Low-latency voice interaction powered by OpenAI Realtime WebRTC with resilient continuous speech transcription.
3. Evidence-Based Evaluation: Nemotron analyzes the entire interview transcript, scoring Content, Communication, Structure, Empathy, and Goal alignment with 100% verifiable quotes from your actual answers.
4. Export: One-click branded PDF performance debrief.

💻 Tech Stack:
- NVIDIA Nemotron 3.5 Lightning 30B (NVIDIA NIM)
- OpenAI Realtime (GA WebRTC calls & client_secrets)
- Next.js 16 (App Router) & TypeScript
- Supabase (PostgreSQL & Auth)
- jsPDF

Check out the 60-second walkthrough video below!
GitHub Repository: https://github.com/Flash0104/agentic-workshop

Tagging our judge: @[Judge Name]
#NVIDIAGTC #NVIDIA #AI #OpenModels #WebRTC #Nemotron
```
