-- Extend meta_accounts so a workspace member can paste a long-lived
-- access token + page/IG IDs while OAuth is still pending Meta review
-- (live-flow step 6 in CLAUDE.md). Once OAuth is approved, the access
-- token will come from the OAuth callback and these fields stay in the
-- same shape.
--
-- Security note: the access_token column holds a secret. The client
-- code never SELECTs it back — only INSERT / UPDATE — and any future
-- server-side caller should read it via the service_role key (or via
-- an Edge Function with Vault), not via the publishable key.

alter table meta_accounts add column if not exists access_token text;
alter table meta_accounts add column if not exists page_id text;
alter table meta_accounts add column if not exists instagram_business_account_id text;
alter table meta_accounts add column if not exists updated_at timestamptz not null default now();
alter table meta_accounts alter column account_id drop not null;

-- Write policies: workspace member of the parent client can insert /
-- update / delete the meta_accounts row.
create policy "meta_accounts insert for workspace members" on meta_accounts
  for insert to authenticated with check (
    exists (
      select 1 from clients c
      where c.id = meta_accounts.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "meta_accounts update for workspace members" on meta_accounts
  for update to authenticated using (
    exists (
      select 1 from clients c
      where c.id = meta_accounts.client_id and is_workspace_member(c.workspace_id)
    )
  ) with check (
    exists (
      select 1 from clients c
      where c.id = meta_accounts.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "meta_accounts delete for workspace members" on meta_accounts
  for delete to authenticated using (
    exists (
      select 1 from clients c
      where c.id = meta_accounts.client_id and is_workspace_member(c.workspace_id)
    )
  );
