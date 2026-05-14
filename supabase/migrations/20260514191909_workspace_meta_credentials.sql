-- Move the Meta access token to the workspace level (one token per
-- agency, not one per client). Move the ad_account_id concept to the
-- location level (each location = its own Meta ad account).
--
-- meta_accounts.access_token + meta_accounts.account_id stay in place
-- as the *fallback* for single-location / pre-migration clients. The
-- Edge Function will prefer workspace_meta_credentials.access_token and
-- per-location locations.ad_account_id when set.

-- ---------------------------------------------------------------------------
-- workspace_meta_credentials: one row per workspace, holds the master token
-- ---------------------------------------------------------------------------
create table if not exists workspace_meta_credentials (
  workspace_id        uuid primary key references workspaces(id) on delete cascade,
  access_token        text,
  business_manager_id text,
  updated_at          timestamptz not null default now()
);

alter table workspace_meta_credentials enable row level security;

-- Read: workspace member. The token itself is sensitive; in practice we
-- only SELECT the public columns (business_manager_id, updated_at, plus
-- a "has access token" boolean derived in the app) — the access_token
-- never goes to the browser. Edge Functions read via service_role.
create policy "workspace_meta_credentials read for members" on workspace_meta_credentials
  for select to authenticated using (is_workspace_member(workspace_id));

-- Write: workspace owner only — this is the agency's master token, not
-- something every team member should rotate.
create policy "workspace_meta_credentials insert for owners" on workspace_meta_credentials
  for insert to authenticated with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_meta_credentials.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_meta_credentials update for owners" on workspace_meta_credentials
  for update to authenticated using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_meta_credentials.workspace_id and w.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_meta_credentials.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_meta_credentials delete for owners" on workspace_meta_credentials
  for delete to authenticated using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_meta_credentials.workspace_id and w.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- locations.ad_account_id — per-location Meta ad account
-- ---------------------------------------------------------------------------
alter table locations add column if not exists ad_account_id text;
