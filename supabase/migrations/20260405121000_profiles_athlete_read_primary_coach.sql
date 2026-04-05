-- Athletes may read the profile row of their primary coach (name/email for dashboard).
drop policy if exists "profiles read assigned coach as athlete" on public.profiles;
create policy "profiles read assigned coach as athlete" on public.profiles
for select using (
  exists (
    select 1 from public.profiles athlete
    where athlete.id = auth.uid()
      and athlete.role = 'athlete'
      and athlete.primary_coach_id = profiles.id
  )
);
