-- generations: saved Ad Studio outputs.
--
-- Mirrors the donor app's generations table, reshaped for Canopy:
-- google_ads / meta_output are jsonb (the donor stored stringified JSON
-- in TEXT columns), and rows hang off workspace + client (+ optional
-- location) instead of a campaigns table — the Ad Studio brief
-- (landing page, idea, medium) is stored inline on the row.

create table if not exists generations (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  client_id         text not null references clients(id) on delete cascade,
  location_id       text references locations(id) on delete set null,
  campaign_name     text not null default '',
  landing_page_url  text,
  campaign_idea     text not null default '',
  medium            text not null default 'BOTH'
                    check (medium in ('GOOGLE_ADS', 'META', 'BOTH')),
  additional_context text,
  -- The creative direction the copy was generated under (if any):
  -- { title, hook, description, themes[] }
  direction         jsonb,
  -- { keywords[], headlines[], descriptions[], signals[] }
  google_ads        jsonb,
  -- { primary_text[], headlines[] }
  meta_output       jsonb,
  -- Provenance: { mode, providers[], models[], job_id }
  provider_meta     jsonb,
  status            text not null default 'draft' check (status in ('draft', 'final')),
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists generations_client_idx on generations (client_id, created_at desc);
create index if not exists generations_workspace_idx on generations (workspace_id, created_at desc);

alter table generations enable row level security;

create policy "generations read for members" on generations
  for select to authenticated using (is_workspace_member(workspace_id));

-- Members save and edit generations directly from the browser (inline
-- edits to headlines/keywords persist client-side; the Edge Function
-- writes with service role when a job completes).
--
-- client_id (and location_id, if set) must belong to the stated workspace,
-- not just any workspace the caller is a member of — otherwise a member of
-- workspace A could tag a generation with a workspace-B client_id, surfacing
-- that client's association to every workspace-A member via the read policy.
create policy "generations insert for members" on generations
  for insert to authenticated with check (
    is_workspace_member(workspace_id)
    and exists (
      select 1 from clients c
      where c.id = generations.client_id and c.workspace_id = generations.workspace_id
    )
    and (
      generations.location_id is null
      or exists (
        select 1 from locations l
        where l.id = generations.location_id and l.client_id = generations.client_id
      )
    )
  );

create policy "generations update for members" on generations
  for update to authenticated using (
    is_workspace_member(workspace_id)
    and exists (
      select 1 from clients c
      where c.id = generations.client_id and c.workspace_id = generations.workspace_id
    )
  ) with check (
    is_workspace_member(workspace_id)
    and exists (
      select 1 from clients c
      where c.id = generations.client_id and c.workspace_id = generations.workspace_id
    )
    and (
      generations.location_id is null
      or exists (
        select 1 from locations l
        where l.id = generations.location_id and l.client_id = generations.client_id
      )
    )
  );

create policy "generations delete for members" on generations
  for delete to authenticated using (is_workspace_member(workspace_id));
