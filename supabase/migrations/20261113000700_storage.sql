-- =====================================================================
-- 0007 STORAGE
-- public-media : website images (public read, CMS editors write)
-- documents    : PRIVATE. No client policies at all: every upload and
--                download goes through the server, which first checks
--                the caller's access to the owning record via RLS and
--                then issues a short-lived signed URL.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('documents', 'documents', false, 10485760, array[
     'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public media read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'public-media');
create policy "public media write" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and public.has_permission('cms.manage'));
create policy "public media update" on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and public.has_permission('cms.manage'));
create policy "public media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and public.has_permission('cms.manage'));
