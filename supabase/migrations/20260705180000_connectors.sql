-- Communication connectors: Resend (email) + Slack (incoming webhook),
-- one config row per workspace. Used by suggestions notifications and
-- client reports.
--
-- RLS is owner-only for BOTH read and write: the Slack webhook URL is a
-- credential (anyone holding it can post to the channel), so it never
-- reaches non-owner browsers. Edge Functions read via service role.

create table if not exists workspace_connectors (
  workspace_id      uuid primary key references workspaces(id) on delete cascade,
  resend_from_email text,
  resend_reply_to   text,
  slack_webhook_url text,
  updated_at        timestamptz not null default now()
);

alter table workspace_connectors enable row level security;

create policy "workspace_connectors select for owners" on workspace_connectors
  for select to authenticated using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_connectors.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_connectors insert for owners" on workspace_connectors
  for insert to authenticated with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_connectors.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_connectors update for owners" on workspace_connectors
  for update to authenticated using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_connectors.workspace_id and w.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_connectors.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_connectors delete for owners" on workspace_connectors
  for delete to authenticated using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_connectors.workspace_id and w.owner_id = auth.uid()
    )
  );

-- Delivery audit trail.
create table if not exists notification_log (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel      text not null check (channel in ('email', 'slack')),
  -- What kind of message: test | suggestions | report
  kind         text not null,
  -- Redacted destination (email address / 'slack webhook')
  target       text,
  status       text not null check (status in ('sent', 'failed')),
  error        text,
  sent_at      timestamptz not null default now()
);

create index if not exists notification_log_workspace_idx
  on notification_log (workspace_id, sent_at desc);

alter table notification_log enable row level security;

create policy "notification_log read for members" on notification_log
  for select to authenticated using (is_workspace_member(workspace_id));
-- Writes: service role only.
