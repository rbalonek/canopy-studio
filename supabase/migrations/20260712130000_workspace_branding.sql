-- Workspace branding: a per-workspace logo (used as the in-app favicon) and a
-- short tagline. Both are optional and default null, so existing workspaces are
-- unaffected. The logo can be uploaded directly (workspace-assets bucket below)
-- or filled by the agency self-scrape (`agency_analysis` job), which also writes
-- the agency profile_docs row.
--
-- NOTE: renamed from 20260712120000 → 20260712130000 to resolve a version
-- collision with 20260712120000_client_monthly_budget.sql. Because both shared
-- a version number, `supabase db push` recorded 20260712120000 (the budget
-- migration) and silently skipped this one, so hosted never got logo_url /
-- tagline — which 400'd the login workspace query. Idempotent throughout so a
-- re-run against an environment that already has these objects is safe.

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

drop policy if exists "workspace-assets read" on storage.objects;
create policy "workspace-assets read" on storage.objects
  for select to authenticated using (bucket_id = 'workspace-assets');

drop policy if exists "workspace-assets insert for members" on storage.objects;
create policy "workspace-assets insert for members" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'workspace-assets'
    and exists (
      select 1 from workspaces w
      where w.id::text = (storage.foldername(name))[1] and is_workspace_member(w.id)
    )
  );

drop policy if exists "workspace-assets delete for members" on storage.objects;
create policy "workspace-assets delete for members" on storage.objects
  for delete to authenticated using (
    bucket_id = 'workspace-assets'
    and exists (
      select 1 from workspaces w
      where w.id::text = (storage.foldername(name))[1] and is_workspace_member(w.id)
    )
  );
