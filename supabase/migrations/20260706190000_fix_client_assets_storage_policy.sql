-- Fix: client-assets storage policies referenced an unqualified `name`, which
-- inside `exists (select 1 from clients c ...)` bound to clients.name (the
-- client's display name) instead of storage.objects.name (the object path).
-- storage.foldername('Gather Pottery') is empty, so the client_id prefix never
-- matched and every member upload/delete was denied by RLS. Qualify as
-- objects.name so it resolves to the object path's first folder (<client_id>).

drop policy if exists "client-assets insert for members" on storage.objects;
drop policy if exists "client-assets delete for members" on storage.objects;

create policy "client-assets insert for members" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'client-assets'
    and exists (
      select 1 from clients c
      where c.id = (storage.foldername(objects.name))[1]
        and is_workspace_member(c.workspace_id)
    )
  );

create policy "client-assets delete for members" on storage.objects
  for delete to authenticated using (
    bucket_id = 'client-assets'
    and exists (
      select 1 from clients c
      where c.id = (storage.foldername(objects.name))[1]
        and is_workspace_member(c.workspace_id)
    )
  );
