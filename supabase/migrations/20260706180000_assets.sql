-- Client asset library: uploaded logos / photos / videos / docs.
--
-- Files live in a PUBLIC storage bucket (`client-assets`) under a per-client
-- path prefix (`<client_id>/<file>`), so each object has a stable public URL —
-- needed to render a logo app-wide and to hand Meta an image_url when
-- publishing. A row in `assets` tracks each upload's metadata; the browser
-- uploads directly via the storage API and inserts the row.

-- --- Storage bucket -------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-assets', 'client-assets', true, 52428800)  -- 50 MB
on conflict (id) do update set public = excluded.public,
                               file_size_limit = excluded.file_size_limit;

-- Public bucket → objects are world-readable by public URL. Writes/deletes are
-- gated to workspace members of the client that owns the path's first segment.
-- storage.foldername(name)[1] is the <client_id> prefix.
create policy "client-assets read" on storage.objects
  for select to authenticated using (bucket_id = 'client-assets');

create policy "client-assets insert for members" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'client-assets'
    and exists (
      select 1 from clients c
      where c.id = (storage.foldername(name))[1] and is_workspace_member(c.workspace_id)
    )
  );

create policy "client-assets delete for members" on storage.objects
  for delete to authenticated using (
    bucket_id = 'client-assets'
    and exists (
      select 1 from clients c
      where c.id = (storage.foldername(name))[1] and is_workspace_member(c.workspace_id)
    )
  );

-- --- Assets metadata table ------------------------------------------------
create table if not exists assets (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null references clients(id) on delete cascade,
  name          text not null,
  kind          text not null default 'Photo'
                check (kind in ('Logo', 'Photo', 'Video', 'Doc')),
  -- Object path within the bucket: '<client_id>/<uuid>-<filename>'.
  storage_path  text not null,
  -- Cached public URL (bucket is public, so this is stable).
  url           text not null,
  mime_type     text,
  size_bytes    bigint,
  analysis_status  text not null default 'Pending'
                   check (analysis_status in ('Analyzed', 'Pending', 'Failed')),
  analysis_summary text,
  created_at    timestamptz not null default now()
);

create index if not exists assets_client_id_idx on assets(client_id);

alter table assets enable row level security;

-- Members of the owning client's workspace can do everything with its assets.
create policy "assets read for members" on assets
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = assets.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "assets insert for members" on assets
  for insert to authenticated with check (
    exists (
      select 1 from clients c
      where c.id = assets.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "assets update for members" on assets
  for update to authenticated using (
    exists (
      select 1 from clients c
      where c.id = assets.client_id and is_workspace_member(c.workspace_id)
    )
  ) with check (
    exists (
      select 1 from clients c
      where c.id = assets.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "assets delete for members" on assets
  for delete to authenticated using (
    exists (
      select 1 from clients c
      where c.id = assets.client_id and is_workspace_member(c.workspace_id)
    )
  );
