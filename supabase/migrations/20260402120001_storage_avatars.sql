-- Optional: public avatars bucket for profile photos (path: {user_id}/{filename})
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar files" on storage.objects;
create policy "Users upload own avatar files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own avatar files" on storage.objects;
create policy "Users update own avatar files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own avatar files" on storage.objects;
create policy "Users delete own avatar files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
