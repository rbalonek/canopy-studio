-- AI plumbing: background jobs, per-workspace AI provider settings, the
-- skills (prompt-module) library, and usage/cost accounting.
--
-- Why a jobs table: the AI engine runs as Supabase Edge Functions with a
-- hard one-LLM-call-per-invocation rule (each collaboration step is its
-- own invocation, chained server-side). The row is the source of truth
-- the frontend polls — same UX as the donor Swimm app's job queue, minus
-- the in-process SQLite queue that doesn't exist in a serverless world.
--
-- Why ai_settings is a table and not env vars: the user explicitly wants
-- to re-mix which provider generates / reviews per task without a deploy.
-- Model IDs therefore live here, never hardcoded in function code.

-- ---------------------------------------------------------------------------
-- jobs: one row per background AI job
-- ---------------------------------------------------------------------------
create table if not exists jobs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  client_id     text references clients(id) on delete cascade,
  type          text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'completed', 'failed')),
  step          int  not null default 0,
  total_steps   int  not null default 1,
  progress      int  not null default 0,
  progress_message text,
  input         jsonb not null default '{}'::jsonb,
  -- Intermediate step state (collaboration drafts, reviews). Internal to
  -- the runner; the UI reads `result`.
  state         jsonb,
  result        jsonb,
  error         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists jobs_workspace_created_idx on jobs (workspace_id, created_at desc);

alter table jobs enable row level security;

-- Members watch job progress; all writes go through Edge Functions with
-- the service role (no insert/update policies on purpose).
create policy "jobs read for members" on jobs
  for select to authenticated using (is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- ai_settings: which provider(s) + model(s) run each AI task
-- ---------------------------------------------------------------------------
create table if not exists ai_settings (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  task              text not null check (task in (
    'copy_generation', 'creative_directions', 'expand_content',
    'regenerate_single', 'website_analysis', 'competitor_analysis',
    'account_analysis', 'report_summary', 'test_prompt'
  )),
  mode              text not null default 'anthropic'
                    check (mode in ('anthropic', 'openai', 'collaboration')),
  primary_provider  text not null default 'anthropic'
                    check (primary_provider in ('anthropic', 'openai')),
  primary_model     text,
  reviewer_provider text check (reviewer_provider in ('anthropic', 'openai')),
  reviewer_model    text,
  options           jsonb not null default '{}'::jsonb,
  updated_at        timestamptz not null default now(),
  unique (workspace_id, task)
);

alter table ai_settings enable row level security;

create policy "ai_settings read for members" on ai_settings
  for select to authenticated using (is_workspace_member(workspace_id));

-- Any member may tune AI settings — day-to-day copywriters are exactly
-- the people who need to flip generator/reviewer. (Master credentials
-- stay owner-only; these are not credentials.)
create policy "ai_settings insert for members" on ai_settings
  for insert to authenticated with check (is_workspace_member(workspace_id));

create policy "ai_settings update for members" on ai_settings
  for update to authenticated using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy "ai_settings delete for members" on ai_settings
  for delete to authenticated using (is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- skills: reusable prompt modules injected into generation system prompts
-- ---------------------------------------------------------------------------
create table if not exists skills (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  -- Markdown. Injected verbatim as "## LEARNED GUIDELINE: <name>" blocks,
  -- so the content maps 1:1 onto vendor-hosted skills later.
  content       text not null,
  applies_to    text[] not null default '{}',
  enabled       boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists skills_workspace_idx on skills (workspace_id, sort_order);

alter table skills enable row level security;

create policy "skills read for members" on skills
  for select to authenticated using (is_workspace_member(workspace_id));

create policy "skills insert for members" on skills
  for insert to authenticated with check (is_workspace_member(workspace_id));

create policy "skills update for members" on skills
  for update to authenticated using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy "skills delete for members" on skills
  for delete to authenticated using (is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- ai_usage_events: token + cost accounting per LLM call
-- ---------------------------------------------------------------------------
create table if not exists ai_usage_events (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  job_id         uuid references jobs(id) on delete set null,
  task           text not null,
  provider       text not null,
  model          text not null,
  input_tokens   int not null default 0,
  output_tokens  int not null default 0,
  cost_usd       numeric(10, 6) not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists ai_usage_events_workspace_idx
  on ai_usage_events (workspace_id, created_at desc);

alter table ai_usage_events enable row level security;

create policy "ai_usage_events read for members" on ai_usage_events
  for select to authenticated using (is_workspace_member(workspace_id));
-- Writes: service role only.
