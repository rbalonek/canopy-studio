-- Google Ads reporting rides the SAME tables as Meta (one display layer,
-- one metrics catalog) — a `platform` column disambiguates, and Google
-- campaign ids are stored prefixed (`gads_<id>`) so the text PKs can never
-- collide with Meta's numeric ids. Publishing later adds an Edge Function,
-- not schema.

alter table campaigns              add column if not exists platform text not null default 'meta';
alter table ad_sets                add column if not exists platform text not null default 'meta';
alter table ads                    add column if not exists platform text not null default 'meta';
alter table campaign_metrics_daily add column if not exists platform text not null default 'meta';

create index if not exists campaigns_client_platform_idx on campaigns (client_id, platform);

-- One Google connection per workspace: the OAuth refresh token (minted by
-- the google-oauth callback with access_type=offline) plus the MCC id the
-- developer token authenticates under. Exact workspace_meta_credentials
-- stance: member SELECT (the app never selects refresh_token), owner-only
-- writes, Edge Functions read via service role.
create table if not exists workspace_google_credentials (
  workspace_id      uuid primary key references workspaces(id) on delete cascade,
  refresh_token     text,
  login_customer_id text,
  updated_at        timestamptz not null default now()
);

alter table workspace_google_credentials enable row level security;

create policy "workspace_google_credentials read for members" on workspace_google_credentials
  for select to authenticated using (is_workspace_member(workspace_id));

create policy "workspace_google_credentials insert for owners" on workspace_google_credentials
  for insert to authenticated with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_google_credentials.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_google_credentials update for owners" on workspace_google_credentials
  for update to authenticated using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_google_credentials.workspace_id and w.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_google_credentials.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_google_credentials delete for owners" on workspace_google_credentials
  for delete to authenticated using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_google_credentials.workspace_id and w.owner_id = auth.uid()
    )
  );

-- Which Google Ads account a client (or location) reports from — the
-- customer id without dashes, mirroring ad_account_id for Meta.
alter table clients   add column if not exists google_customer_id text;
alter table locations add column if not exists google_customer_id text;
