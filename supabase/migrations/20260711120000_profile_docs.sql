-- Profile docs: one CLAUDE.md-style markdown document per entity — the
-- workspace/agency (client_id null) or a single client. Injected into every
-- AI system prompt alongside skills (prompts.ts profileBlock), giving each
-- tenant a standing, human-maintained context document the pipeline always
-- sees. Unlike skills (many rows, applies_to task filtering), a profile is
-- exactly one document per entity — hence the unique constraint, and why
-- this is its own table rather than a skills extension.

create table if not exists profile_docs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id    text references clients(id) on delete cascade,
  content      text not null default '',
  updated_at   timestamptz not null default now(),
  -- one doc per entity; "nulls not distinct" makes the agency-level row
  -- (client_id null) unique too.
  unique nulls not distinct (workspace_id, client_id)
);

create index if not exists profile_docs_workspace_idx
  on profile_docs (workspace_id, client_id);

alter table profile_docs enable row level security;

-- Not a credential — any member can read and edit, same as skills.
create policy "profile_docs read for members" on profile_docs
  for select to authenticated using (is_workspace_member(workspace_id));

create policy "profile_docs insert for members" on profile_docs
  for insert to authenticated with check (is_workspace_member(workspace_id));

create policy "profile_docs update for members" on profile_docs
  for update to authenticated
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

create policy "profile_docs delete for members" on profile_docs
  for delete to authenticated using (is_workspace_member(workspace_id));
