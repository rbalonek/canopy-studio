-- BYO provider API keys: a workspace can supply its own Anthropic / OpenAI /
-- xAI key so AI calls run on the customer's account instead of the platform
-- keys (Edge Function secrets remain the fallback). Billing prices BYO-key
-- usage differently (small platform fee instead of full markup) — see
-- _shared/ai/usage.ts once the billing phase lands.
--
-- Same credential stance as workspace_meta_credentials: members may SELECT
-- (the app only ever selects provider/updated_at — never api_key), writes
-- are owner-only, Edge Functions read via service role.

create table if not exists workspace_api_keys (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider     text not null check (provider in ('anthropic', 'openai', 'xai')),
  api_key      text not null,
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, provider)
);

alter table workspace_api_keys enable row level security;

create policy "workspace_api_keys read for members" on workspace_api_keys
  for select to authenticated using (is_workspace_member(workspace_id));

create policy "workspace_api_keys insert for owners" on workspace_api_keys
  for insert to authenticated with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_api_keys.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_api_keys update for owners" on workspace_api_keys
  for update to authenticated using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_api_keys.workspace_id and w.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_api_keys.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_api_keys delete for owners" on workspace_api_keys
  for delete to authenticated using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_api_keys.workspace_id and w.owner_id = auth.uid()
    )
  );
