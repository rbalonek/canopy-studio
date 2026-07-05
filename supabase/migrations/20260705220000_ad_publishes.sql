-- ad_publishes: audit trail for generations pushed into Meta as real
-- (always-PAUSED) campaign/adset/ad objects. One row per publish
-- attempt; the Graph object ids land here as they're created so a
-- partial failure is diagnosable.

create table if not exists ad_publishes (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  client_id        text not null references clients(id) on delete cascade,
  generation_id    uuid references generations(id) on delete set null,
  ad_account_id    text not null,
  page_id          text,
  meta_campaign_id text,
  meta_adset_id    text,
  meta_creative_id text,
  meta_ad_id       text,
  daily_budget_cents int,
  status           text not null default 'publishing'
                   check (status in ('publishing', 'paused_live', 'failed')),
  error            text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  published_at     timestamptz
);

create index if not exists ad_publishes_workspace_idx
  on ad_publishes (workspace_id, created_at desc);

alter table ad_publishes enable row level security;

create policy "ad_publishes read for members" on ad_publishes
  for select to authenticated using (is_workspace_member(workspace_id));
-- Writes: service role only (the publish Edge Function).
