-- Per-client Meta app override. The workspace holds the agency's master
-- token (workspace_meta_credentials); some clients run under a different
-- Meta app during testing (e.g. a dedicated posting app), so a client can
-- carry its own token that WINS over the workspace one. Resolution order
-- in the Edge Functions becomes:
--   client_meta_credentials → workspace_meta_credentials → meta_accounts
-- (legacy per-client fallback). Manual-token era only — a proper Meta
-- OAuth login replaces all of this later.

create table if not exists client_meta_credentials (
  client_id    text primary key references clients(id) on delete cascade,
  access_token text,
  -- Informational: which Meta app this token belongs to, so the UI can
  -- say "RDS - Posting App (1830…)" instead of just "a different token".
  app_id       text,
  label        text,
  updated_at   timestamptz not null default now()
);

alter table client_meta_credentials enable row level security;

-- Read: workspace members (the UI shows presence + app label; like the
-- workspace panel it treats the token itself as write-only). Writes:
-- workspace owner only — same trust level as the master token.
create policy "client_meta_credentials read for members" on client_meta_credentials
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = client_meta_credentials.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "client_meta_credentials insert for owners" on client_meta_credentials
  for insert to authenticated with check (
    exists (
      select 1 from clients c
      join workspaces w on w.id = c.workspace_id
      where c.id = client_meta_credentials.client_id and w.owner_id = auth.uid()
    )
  );

create policy "client_meta_credentials update for owners" on client_meta_credentials
  for update to authenticated using (
    exists (
      select 1 from clients c
      join workspaces w on w.id = c.workspace_id
      where c.id = client_meta_credentials.client_id and w.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from clients c
      join workspaces w on w.id = c.workspace_id
      where c.id = client_meta_credentials.client_id and w.owner_id = auth.uid()
    )
  );

create policy "client_meta_credentials delete for owners" on client_meta_credentials
  for delete to authenticated using (
    exists (
      select 1 from clients c
      join workspaces w on w.id = c.workspace_id
      where c.id = client_meta_credentials.client_id and w.owner_id = auth.uid()
    )
  );
