-- Allow workspace members to update / delete clients in their workspace
-- (insert + read policies already exist from live_flow_workspaces). Powers
-- the Edit/Delete client actions in the client detail header. Deletes
-- cascade to locations / campaigns / scraped_* / brand_profiles / etc. via
-- the existing FKs.

create policy "clients update for workspace members" on clients
  for update to authenticated using (
    is_workspace_member(workspace_id)
  ) with check (
    is_workspace_member(workspace_id)
  );

create policy "clients delete for workspace members" on clients
  for delete to authenticated using (
    is_workspace_member(workspace_id)
  );
