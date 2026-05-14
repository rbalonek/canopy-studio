-- Replace the implicit "INSERT INTO workspaces, then trigger inserts
-- into workspace_members" pattern with an explicit SECURITY DEFINER RPC.
--
-- Why: the previous version had a subtle failure mode where the trigger's
-- downstream insert into workspace_members would fail under FORCE RLS or
-- certain Supabase configurations, surfacing as a confusing "row-level
-- security policy violation on workspaces" because the whole transaction
-- rolled back. The RPC does both inserts atomically as the function's
-- owner role, sidestepping RLS for the bootstrap (where the user can't
-- yet be a workspace_member, so RLS-via-policy is awkward), and surfaces
-- a clear "Not authenticated" error if auth.uid() comes back null.

set search_path = public;

-- Drop the old trigger + function. We'll do both inserts in the RPC.
drop trigger if exists workspaces_add_owner on workspaces;
drop function if exists add_owner_as_member();

create or replace function create_workspace(
  p_name text,
  p_slug text,
  p_mode text
)
returns workspaces
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid;
  ws workspaces;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_mode not in ('agency', 'business') then
    raise exception 'Invalid mode: %', p_mode using errcode = '22023';
  end if;

  insert into workspaces (name, slug, mode, owner_id)
  values (p_name, p_slug, p_mode, uid)
  returning * into ws;

  insert into workspace_members (workspace_id, user_id, role)
  values (ws.id, uid, 'owner');

  return ws;
end;
$$;

grant execute on function create_workspace(text, text, text) to authenticated;
