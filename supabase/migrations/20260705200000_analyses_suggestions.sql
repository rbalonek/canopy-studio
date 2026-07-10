-- Periodic account analysis → actionable suggestions.
--
-- The account_analysis job (ad-optimizer's strategy-aware analyst
-- prompt) reads campaigns + daily metrics history from Supabase (never
-- Meta directly), writes one analyses row per run, and explodes the
-- recommendations into suggestions rows the team can acknowledge,
-- dismiss, or draft an ad from.

create table if not exists analyses (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id    text references clients(id) on delete cascade,
  kind         text not null default 'account' check (kind in ('account', 'competitor')),
  -- Full model output: { overall_summary, urgent_issues[], top_priorities[], ... }
  summary      jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists analyses_workspace_idx on analyses (workspace_id, created_at desc);

alter table analyses enable row level security;

create policy "analyses read for members" on analyses
  for select to authenticated using (is_workspace_member(workspace_id));
-- Writes: service role only.

create table if not exists suggestions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  client_id       text references clients(id) on delete cascade,
  analysis_id     uuid references analyses(id) on delete cascade,
  priority        text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  action          text not null,
  reasoning       text,
  expected_impact text,
  campaign_id     text,
  status          text not null default 'new'
                  check (status in ('new', 'acknowledged', 'dismissed', 'actioned')),
  created_at      timestamptz not null default now()
);

create index if not exists suggestions_workspace_idx
  on suggestions (workspace_id, status, created_at desc);

alter table suggestions enable row level security;

create policy "suggestions read for members" on suggestions
  for select to authenticated using (is_workspace_member(workspace_id));

-- Members work the queue: status changes only, from the browser.
create policy "suggestions update for members" on suggestions
  for update to authenticated using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));
-- Inserts: service role only (the analysis job).

-- Weekly analysis: Mondays 07:00 UTC (after the 06:00 refresh).
do $$
begin
  perform cron.unschedule('canopy-analysis-weekly');
exception when others then
  null;
end $$;

select cron.schedule(
  'canopy-analysis-weekly',
  '0 7 * * 1',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'canopy_functions_url') || '/cron-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'canopy_internal_fn_secret')
    ),
    body := jsonb_build_object('task', 'analysis_all')
  );
  $$
);
