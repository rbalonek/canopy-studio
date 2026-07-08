-- Let the workspace owner update their workspace (rename + mode) from
-- Settings -> Workspace. Members can read (existing policy) but only the
-- owner mutates; the slug stays effectively frozen because every /app URL
-- embeds it — the UI never sends it.

create policy "workspaces update for owner" on workspaces
  for update to authenticated using (
    owner_id = auth.uid()
  ) with check (
    owner_id = auth.uid()
  );
