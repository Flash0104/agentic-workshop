-- Agentic Workshop Trainer - Database Schema

-- Enable RLS
alter database postgres set "app.jwt_secret" to 'your-jwt-secret-here';

-- Sessions table
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  language text default 'en' check (language in ('en', 'de')),
  mode text check (mode in ('easy','normal','hard')) not null,
  scenario text check (scenario in ('interview','sales')) not null default 'interview',
  job_url text,
  job_json jsonb,
  job_description text,
  cv_text text,
  generated_questions jsonb,
  created_at timestamptz default now(),
  ended_at timestamptz
);

-- Turns table (conversation messages)
create table if not exists public.turns (
  id bigserial primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text check (role in ('user','ai','system')) not null,
  content text not null,
  audio_url text,
  created_at timestamptz default now()
);

-- Evaluations table
create table if not exists public.evaluations (
  id bigserial primary key,
  session_id uuid unique not null references public.sessions(id) on delete cascade,
  rubric jsonb not null,
  scores jsonb not null,
  total_score int not null check (total_score between 0 and 100),
  highlights text[],
  improvements text[],
  report_markdown text not null,
  created_at timestamptz default now()
);

-- Surveys table (Akzeptanzstudie)
create table if not exists public.surveys (
  id bigserial primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  trust int check (trust between 1 and 5),
  usefulness int check (usefulness between 1 and 5),
  comfort int check (comfort between 1 and 5),
  difficulty int check (difficulty between 1 and 5),
  reuse int check (reuse between 1 and 5),
  free_text text,
  created_at timestamptz default now()
);

-- Create indexes
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists turns_session_id_idx on public.turns(session_id);
create index if not exists evaluations_session_id_idx on public.evaluations(session_id);
create index if not exists surveys_session_id_idx on public.surveys(session_id);

-- Enable Row Level Security
alter table public.sessions enable row level security;
alter table public.turns enable row level security;
alter table public.evaluations enable row level security;
alter table public.surveys enable row level security;

-- RLS Policies for sessions
create policy "Users can view own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- RLS Policies for turns
create policy "Users can view turns of own sessions"
  on public.turns for select
  using (
    exists (
      select 1 from public.sessions
      where sessions.id = turns.session_id
      and sessions.user_id = auth.uid()
    )
  );

create policy "Users can insert turns to own sessions"
  on public.turns for insert
  with check (
    exists (
      select 1 from public.sessions
      where sessions.id = turns.session_id
      and sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for evaluations
create policy "Users can view evaluations of own sessions"
  on public.evaluations for select
  using (
    exists (
      select 1 from public.sessions
      where sessions.id = evaluations.session_id
      and sessions.user_id = auth.uid()
    )
  );

create policy "Users can insert evaluations for own sessions"
  on public.evaluations for insert
  with check (
    exists (
      select 1 from public.sessions
      where sessions.id = evaluations.session_id
      and sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for surveys
create policy "Users can view surveys of own sessions"
  on public.surveys for select
  using (
    exists (
      select 1 from public.sessions
      where sessions.id = surveys.session_id
      and sessions.user_id = auth.uid()
    )
  );

create policy "Users can insert surveys for own sessions"
  on public.surveys for insert
  with check (
    exists (
      select 1 from public.sessions
      where sessions.id = surveys.session_id
      and sessions.user_id = auth.uid()
    )
  );




