-- Team management: invite-by-email + member listing/administration.
--
-- Invites are matched by email at login ("accept-on-login"): the frontend
-- calls accept_workspace_invites() once per session before listing
-- workspaces, so an invited person just signs up/in with that email and
-- lands in the workspace — no token links to build yet.
--
-- workspace_members RLS deliberately stayed "read self" (recursion
-- avoidance); listing the roster crosses that line on purpose via a
-- SECURITY DEFINER RPC that re-checks membership itself. Role changes and
-- removals are owner-only RPCs with an owner-row guard.

create table if not exists workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email        text not null,
  role         text not null default 'member' check (role in ('admin', 'member')),
  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null,
  unique (workspace_id, email)
);

alter table workspace_invites enable row level security;

create policy "workspace_invites read for members" on workspace_invites
  for select to authenticated using (is_workspace_member(workspace_id));

create policy "workspace_invites insert for owners" on workspace_invites
  for insert to authenticated with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_invites.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_invites delete for owners" on workspace_invites
  for delete to authenticated using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_invites.workspace_id and w.owner_id = auth.uid()
    )
  );

-- Roster: user_id, role, name, email — member-visible.
create or replace function list_workspace_members(ws_id uuid)
returns table (user_id uuid, role text, display_name text, email text, is_owner boolean)
language sql security definer stable set search_path = public as $$
  select m.user_id,
         m.role,
         p.display_name,
         u.email::text,
         (w.owner_id = m.user_id) as is_owner
  from workspace_members m
  join workspaces w on w.id = m.workspace_id
  left join profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.workspace_id = ws_id
    and is_workspace_member(ws_id)
  order by (w.owner_id = m.user_id) desc, m.role, u.email;
$$;

-- Owner-only role change; the owner's own row is immutable (they stay owner).
create or replace function set_member_role(ws_id uuid, member_id uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if new_role not in ('admin', 'member') then
    raise exception 'invalid role';
  end if;
  if not exists (select 1 from workspaces w where w.id = ws_id and w.owner_id = auth.uid()) then
    raise exception 'only the workspace owner can change roles';
  end if;
  if exists (select 1 from workspaces w where w.id = ws_id and w.owner_id = member_id) then
    raise exception 'the owner''s role cannot be changed';
  end if;
  update workspace_members set role = new_role
  where workspace_id = ws_id and user_id = member_id;
end $$;

-- Owner-only removal; the owner cannot be removed.
create or replace function remove_workspace_member(ws_id uuid, member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from workspaces w where w.id = ws_id and w.owner_id = auth.uid()) then
    raise exception 'only the workspace owner can remove members';
  end if;
  if exists (select 1 from workspaces w where w.id = ws_id and w.owner_id = member_id) then
    raise exception 'the owner cannot be removed';
  end if;
  delete from workspace_members where workspace_id = ws_id and user_id = member_id;
end $$;

-- Accept-on-login: claim every open invite matching my email. Returns how
-- many were accepted (0 for almost every login — one cheap indexed query).
create or replace function accept_workspace_invites()
returns int language plpgsql security definer set search_path = public as $$
declare
  my_email text;
  accepted int := 0;
begin
  select u.email into my_email from auth.users u where u.id = auth.uid();
  if my_email is null then return 0; end if;

  with open_invites as (
    select id, workspace_id, role from workspace_invites
    where lower(email) = lower(my_email) and accepted_at is null
  ), added as (
    insert into workspace_members (workspace_id, user_id, role)
    select workspace_id, auth.uid(), role from open_invites
    on conflict (workspace_id, user_id) do nothing
    returning workspace_id
  )
  update workspace_invites wi
  set accepted_at = now(), accepted_by = auth.uid()
  from open_invites oi
  where wi.id = oi.id;

  get diagnostics accepted = row_count;
  return accepted;
end $$;
