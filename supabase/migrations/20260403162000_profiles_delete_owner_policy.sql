drop policy if exists "profiles delete by owner" on public.profiles;
create policy "profiles delete by owner" on public.profiles
for delete using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
);

