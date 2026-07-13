-- Workspace branding: a per-workspace logo (used as the in-app favicon) and a
-- short tagline. Both are optional and default null, so existing workspaces are
-- unaffected. The logo can be uploaded directly (workspace-assets bucket below)
-- or filled by the agency self-scrape (`agency_analysis` job), which also writes
-- the agency profile_docs row.

alter table workspaces add column if not exists logo_url text;
alter table workspaces add column if not exists tagline text;

-- --- Storage bucket for workspace-level uploads ---------------------------
-- Mirrors `client-assets` (public, stable URLs) but the path's first segment is
-- a <workspace_id> and writes are gated to that workspace's members. Public read
-- so the logo can render app-wide and serve as the favicon.
insert into storage.buckets (id, name, public, file_size_limit)
values ('workspace-assets', 'workspace-assets', true, 52428800)  -- 50 MB
on conflict (id) do update set public = excluded.public,
                               file_size_limit = excluded.file_size_limit;

create policy "workspace-assets read" on storage.objects
  for select to authenticated using (bucket_id = 'workspace-assets');

create policy "workspace-assets insert for members" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'workspace-assets'
    and exists (
      select 1 from workspaces w
      where w.id::text = (storage.foldername(name))[1] and is_workspace_member(w.id)
    )
  );

create policy "workspace-assets delete for members" on storage.objects
  for delete to authenticated using (
    bucket_id = 'workspace-assets'
    and exists (
      select 1 from workspaces w
      where w.id::text = (storage.foldername(name))[1] and is_workspace_member(w.id)
    )
  );
