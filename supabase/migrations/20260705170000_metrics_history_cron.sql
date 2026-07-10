-- Daily campaign metrics history + scheduled refresh plumbing.
--
-- campaign_metrics_daily accumulates one row per campaign per day (the
-- ad-optimizer pattern: reads always come from Supabase; Meta is hit on
-- explicit/scheduled refresh only). The refresh Edge Function writes
-- yesterday's numbers on every run — over time this becomes the history
-- that account analysis and client reports roll up.
--
-- pg_cron + pg_net drive the schedule: a daily job POSTs to the
-- cron-dispatch Edge Function. The function URL and internal secret are
-- read from Vault AT RUN TIME — create these two secrets once per
-- environment (Dashboard → Vault, or `select vault.create_secret(...)`):
--   canopy_functions_url        e.g. https://<ref>.supabase.co/functions/v1
--   canopy_internal_fn_secret   must equal the INTERNAL_FN_SECRET
--                               function secret
-- Until they exist, the cron job errors harmlessly in cron.job_run_details.

create table if not exists campaign_metrics_daily (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  text not null references campaigns(id) on delete cascade,
  client_id    text not null references clients(id) on delete cascade,
  date         date not null,
  spend        numeric not null default 0,
  impressions  numeric not null default 0,
  clicks       numeric not null default 0,
  results      numeric not null default 0,
  result_type  text,
  -- Everything else worth keeping from the day's insights payload.
  metrics      jsonb,
  created_at   timestamptz not null default now(),
  unique (campaign_id, date)
);

create index if not exists campaign_metrics_daily_client_idx
  on campaign_metrics_daily (client_id, date desc);

alter table campaign_metrics_daily enable row level security;

create policy "campaign_metrics_daily read for members" on campaign_metrics_daily
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = campaign_metrics_daily.client_id and is_workspace_member(c.workspace_id)
    )
  );
-- Writes: service role only (the refresh Edge Function).

-- ---------------------------------------------------------------------------
-- Scheduling
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-schedule idempotently (unschedule if present, then schedule).
do $$
begin
  perform cron.unschedule('canopy-refresh-daily');
exception when others then
  null; -- not scheduled yet
end $$;

-- 06:00 UTC daily: refresh every client's campaigns from Meta.
select cron.schedule(
  'canopy-refresh-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'canopy_functions_url') || '/cron-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'canopy_internal_fn_secret')
    ),
    body := jsonb_build_object('task', 'refresh_all')
  );
  $$
);
