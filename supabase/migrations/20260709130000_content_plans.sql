-- Content planner: AI-planned social posting calendars.
--
-- A `content_plan` AI job takes a brief (objective, channels, date range,
-- cadence) and generates one row per posting slot into `content_posts` —
-- per-platform captions (FB and IG are separate Graph API calls with
-- independent copy, per the Meta publishing research in CLAUDE.md), a
-- topic, a format, and an image prompt for later image generation. The
-- plan row keeps the brief + the AI's overview so a plan can be reviewed,
-- extended, or regenerated. Publishing (Graph API + pg_cron dispatch) is a
-- later phase; the status vocabulary already reserves its states.

create table if not exists content_plans (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  client_id      text not null references clients(id) on delete cascade,
  location_id    text references locations(id) on delete set null,
  title          text not null default '',
  -- The user's brief: what the month of content should achieve / promote.
  objective      text not null default '',
  channels       text[] not null default '{facebook,instagram}',
  start_date     date not null,
  end_date       date not null,
  posts_per_week int not null default 7 check (posts_per_week between 1 and 7),
  -- AI output that isn't per-post: { overview, themes: [{week, theme}] }
  summary        jsonb,
  -- Provenance: { job_id }
  provider_meta  jsonb,
  status         text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists content_plans_client_idx on content_plans (client_id, updated_at desc);
create index if not exists content_plans_workspace_idx on content_plans (workspace_id, updated_at desc);

-- One row per planned post. scheduled_date/scheduled_time are separate
-- columns on purpose: the calendar groups by civil date, and composing a
-- real timestamptz (with the client's timezone) is the publish phase's
-- job — storing a timestamptz now would shift days at render time.
create table if not exists content_posts (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid references content_plans(id) on delete cascade,
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  client_id       text not null references clients(id) on delete cascade,
  location_id     text references locations(id) on delete set null,
  scheduled_date  date not null,
  scheduled_time  time not null default '10:00',
  channels        text[] not null default '{facebook,instagram}',
  format          text not null default 'post'
                  check (format in ('post', 'reel', 'carousel', 'story')),
  topic           text not null default '',
  -- Per-platform captions — FB and IG are separate API calls with
  -- independent copy (IG carries hashtags; FB reads better without).
  caption_fb      text,
  caption_ig      text,
  -- Brief for the image-generation step (provider configured in
  -- ai_settings task 'image_generation'); image_url is filled by that
  -- step or by picking an asset from the client's library.
  image_prompt    text,
  image_url       text,
  status          text not null default 'draft'
                  check (status in ('draft', 'approved', 'scheduled', 'published', 'failed')),
  published_at    timestamptz,
  publish_error   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists content_posts_client_date_idx on content_posts (client_id, scheduled_date);
create index if not exists content_posts_plan_idx on content_posts (plan_id);

-- Register the new AI tasks, and 'xai' as a provider choice: image
-- generation is provider-pluggable data like every other AI setting
-- (default in the UI is xAI; no model IDs in function code).
alter table ai_settings drop constraint if exists ai_settings_task_check;
alter table ai_settings add constraint ai_settings_task_check check (task in (
  'copy_generation', 'creative_directions', 'expand_content',
  'regenerate_single', 'website_analysis', 'location_detection',
  'competitor_analysis', 'account_analysis', 'report_summary',
  'content_plan', 'image_generation', 'test_prompt'
));
alter table ai_settings drop constraint if exists ai_settings_mode_check;
alter table ai_settings add constraint ai_settings_mode_check check (
  mode in ('anthropic', 'openai', 'collaboration', 'xai')
);
alter table ai_settings drop constraint if exists ai_settings_primary_provider_check;
alter table ai_settings add constraint ai_settings_primary_provider_check check (
  primary_provider in ('anthropic', 'openai', 'xai')
);

-- RLS: same shape as generations — members read and edit directly from
-- the browser (caption edits, approvals, rescheduling); the content_plan
-- job's finalize writes with the service role. The client_id (and
-- location_id) must belong to the stated workspace so a member of
-- workspace A can't tag rows with a workspace-B client.

alter table content_plans enable row level security;

create policy "content_plans read for members" on content_plans
  for select to authenticated using (is_workspace_member(workspace_id));

create policy "content_plans insert for members" on content_plans
  for insert to authenticated with check (
    is_workspace_member(workspace_id)
    and exists (
      select 1 from clients c
      where c.id = content_plans.client_id and c.workspace_id = content_plans.workspace_id
    )
    and (
      content_plans.location_id is null
      or exists (
        select 1 from locations l
        where l.id = content_plans.location_id and l.client_id = content_plans.client_id
      )
    )
  );

create policy "content_plans update for members" on content_plans
  for update to authenticated using (
    is_workspace_member(workspace_id)
  ) with check (
    is_workspace_member(workspace_id)
    and exists (
      select 1 from clients c
      where c.id = content_plans.client_id and c.workspace_id = content_plans.workspace_id
    )
    and (
      content_plans.location_id is null
      or exists (
        select 1 from locations l
        where l.id = content_plans.location_id and l.client_id = content_plans.client_id
      )
    )
  );

create policy "content_plans delete for members" on content_plans
  for delete to authenticated using (is_workspace_member(workspace_id));

alter table content_posts enable row level security;

create policy "content_posts read for members" on content_posts
  for select to authenticated using (is_workspace_member(workspace_id));

create policy "content_posts insert for members" on content_posts
  for insert to authenticated with check (
    is_workspace_member(workspace_id)
    and exists (
      select 1 from clients c
      where c.id = content_posts.client_id and c.workspace_id = content_posts.workspace_id
    )
    and (
      content_posts.location_id is null
      or exists (
        select 1 from locations l
        where l.id = content_posts.location_id and l.client_id = content_posts.client_id
      )
    )
  );

create policy "content_posts update for members" on content_posts
  for update to authenticated using (
    is_workspace_member(workspace_id)
  ) with check (
    is_workspace_member(workspace_id)
    and exists (
      select 1 from clients c
      where c.id = content_posts.client_id and c.workspace_id = content_posts.workspace_id
    )
    and (
      content_posts.location_id is null
      or exists (
        select 1 from locations l
        where l.id = content_posts.location_id and l.client_id = content_posts.client_id
      )
    )
  );

create policy "content_posts delete for members" on content_posts
  for delete to authenticated using (is_workspace_member(workspace_id));
