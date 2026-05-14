-- Live-flow step 2: workspaces schema.
--
-- Adds profiles + workspaces + workspace_members, scopes clients (and the
-- child tables hung off clients) to a workspace, and flips the public RLS
-- from "anon may read everything" to "authenticated workspace member may
-- read their workspace's rows."
--
-- Notes
--  - workspace IDs are uuid (new concept, no mock data to match). The
--    existing client/location/etc. ids stay text to keep mock parity.
--  - The previous anon_read policies are dropped. /dev/* now reads from
--    the mock provider (see App.tsx), so nothing in the app expects anon
--    DB access anymore.
--  - Existing seed clients are wiped — they're not bound to any
--    workspace, so they would be invisible to authenticated users anyway.
--    The /dev showcase still has access via the mock fixtures.

set search_path = public;

-- ---------------------------------------------------------------------------
-- profiles: per-user app data, 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  mode          text not null default 'agency' check (mode in ('agency', 'business')),
  created_at    timestamptz not null default now()
);
comment on table profiles is
  'Per-user profile linked to auth.users. Stores display name + active mode.';

-- ---------------------------------------------------------------------------
-- workspaces: the tenant unit
-- ---------------------------------------------------------------------------
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  mode        text not null default 'agency' check (mode in ('agency', 'business')),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
comment on column workspaces.slug is
  'URL slug used in /app/<slug>/... paths. Lowercase, hyphen-delimited.';

-- ---------------------------------------------------------------------------
-- workspace_members: many-to-many between users and workspaces
-- ---------------------------------------------------------------------------
create table workspace_members (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- is_workspace_member: SECURITY DEFINER helper to dodge RLS recursion
-- (policies on workspace_members that subquery workspace_members would
-- otherwise infinite-loop).
-- ---------------------------------------------------------------------------
create or replace function is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Trigger: auto-add workspace owner as a member on insert
-- ---------------------------------------------------------------------------
create or replace function add_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger workspaces_add_owner
  after insert on workspaces
  for each row execute function add_owner_as_member();

-- ---------------------------------------------------------------------------
-- Scope clients (and children) to a workspace
-- ---------------------------------------------------------------------------
delete from clients;  -- wipe orphan seed data; mock fixtures still cover /dev

alter table clients
  add column workspace_id uuid not null references workspaces(id) on delete cascade;
create index clients_workspace_id_idx on clients (workspace_id);

alter table urgent_issues
  add column workspace_id uuid not null references workspaces(id) on delete cascade;
create index urgent_issues_workspace_id_idx on urgent_issues (workspace_id);

-- ---------------------------------------------------------------------------
-- RLS — new tables
-- ---------------------------------------------------------------------------
alter table profiles          enable row level security;
alter table workspaces        enable row level security;
alter table workspace_members enable row level security;

-- profiles: a user reads/writes only their own row
create policy "profiles read self" on profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles insert self" on profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles update self" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- workspaces: members can read; authenticated users may insert workspaces they own
create policy "workspaces read for members" on workspaces
  for select to authenticated using (is_workspace_member(id));
create policy "workspaces insert if self-owner" on workspaces
  for insert to authenticated with check (owner_id = auth.uid());

-- workspace_members: user reads their own rows (i.e. "what workspaces am I in")
create policy "workspace_members read self" on workspace_members
  for select to authenticated using (user_id = auth.uid());
-- (insert is performed by the trigger as security definer; no insert policy
-- needed for client-side inserts in this phase.)

-- ---------------------------------------------------------------------------
-- RLS — flip clients + child tables from anon_read to workspace-scoped
-- ---------------------------------------------------------------------------
drop policy if exists anon_read on clients;
drop policy if exists anon_read on locations;
drop policy if exists anon_read on client_card_stats;
drop policy if exists anon_read on client_kpis;
drop policy if exists anon_read on meta_accounts;
drop policy if exists anon_read on client_perf;
drop policy if exists anon_read on urgent_issues;

create policy "clients read for workspace members" on clients
  for select to authenticated using (is_workspace_member(workspace_id));
create policy "clients insert for workspace members" on clients
  for insert to authenticated with check (is_workspace_member(workspace_id));

-- Child tables: gate via the parent client's workspace_id
create policy "locations read for workspace members" on locations
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = locations.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "client_card_stats read for workspace members" on client_card_stats
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = client_card_stats.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "client_kpis read for workspace members" on client_kpis
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = client_kpis.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "meta_accounts read for workspace members" on meta_accounts
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = meta_accounts.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "client_perf read for workspace members" on client_perf
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = client_perf.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "urgent_issues read for workspace members" on urgent_issues
  for select to authenticated using (is_workspace_member(workspace_id));
