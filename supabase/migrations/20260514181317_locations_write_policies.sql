-- Allow workspace members to insert / update / delete locations under
-- clients in their workspace. Read policy from live_flow_workspaces is
-- unchanged. Scoped via the parent client's workspace_id.

create policy "locations insert for workspace members" on locations
  for insert to authenticated with check (
    exists (
      select 1 from clients c
      where c.id = locations.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "locations update for workspace members" on locations
  for update to authenticated using (
    exists (
      select 1 from clients c
      where c.id = locations.client_id and is_workspace_member(c.workspace_id)
    )
  ) with check (
    exists (
      select 1 from clients c
      where c.id = locations.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "locations delete for workspace members" on locations
  for delete to authenticated using (
    exists (
      select 1 from clients c
      where c.id = locations.client_id and is_workspace_member(c.workspace_id)
    )
  );
