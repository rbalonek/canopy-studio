-- Client reports: opt-in per client, daily / weekly / monthly, delivered
-- by email (Resend) and/or Slack. The send_report job rolls up
-- campaign_metrics_daily for the period, writes the narrative through
-- the AI orchestrator (report_summary task — skills apply), renders
-- HTML, sends via the workspace connectors, and logs to sent_reports.

create table if not exists report_settings (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id    text not null references clients(id) on delete cascade,
  cadence      text not null check (cadence in ('daily', 'weekly', 'monthly')),
  channel      text not null default 'email' check (channel in ('email', 'slack', 'both')),
  recipients   text[] not null default '{}',
  enabled      boolean not null default true,
  last_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (client_id, cadence)
);

alter table report_settings enable row level security;

create policy "report_settings read for members" on report_settings
  for select to authenticated using (is_workspace_member(workspace_id));

create policy "report_settings insert for members" on report_settings
  for insert to authenticated with check (is_workspace_member(workspace_id));

create policy "report_settings update for members" on report_settings
  for update to authenticated using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy "report_settings delete for members" on report_settings
  for delete to authenticated using (is_workspace_member(workspace_id));

create table if not exists sent_reports (
  id                 uuid primary key default gen_random_uuid(),
  report_settings_id uuid references report_settings(id) on delete set null,
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  client_id          text references clients(id) on delete cascade,
  cadence            text not null,
  period_start       date not null,
  period_end         date not null,
  subject            text not null,
  body_html          text,
  status             text not null check (status in ('sent', 'failed')),
  error              text,
  sent_at            timestamptz not null default now()
);

create index if not exists sent_reports_workspace_idx
  on sent_reports (workspace_id, sent_at desc);

alter table sent_reports enable row level security;

create policy "sent_reports read for members" on sent_reports
  for select to authenticated using (is_workspace_member(workspace_id));
-- Writes: service role only.

-- One daily dispatch at 07:00 UTC; cron-dispatch works out which
-- cadences are due (daily always, weekly on Mondays, monthly on the 1st).
do $$
begin
  perform cron.unschedule('canopy-reports-daily');
exception when others then
  null;
end $$;

select cron.schedule(
  'canopy-reports-daily',
  '0 7 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'canopy_functions_url') || '/cron-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'canopy_internal_fn_secret')
    ),
    body := jsonb_build_object('task', 'reports_due')
  );
  $$
);
