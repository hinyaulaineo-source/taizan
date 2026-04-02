drop policy if exists "sessions delete by owner or creator" on public.sessions;
create policy "sessions delete by owner or creator" on public.sessions
for delete using (
  created_by = auth.uid() or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
);

drop policy if exists "bookings delete by athlete parent or privileged" on public.bookings;
create policy "bookings delete by athlete parent or privileged" on public.bookings
for delete using (
  athlete_id = auth.uid() or
  exists (
    select 1
    from public.parent_athlete_links l
    where l.parent_id = auth.uid()
      and l.athlete_id = public.bookings.athlete_id
  ) or
  exists (
    select 1
    from public.sessions s
    join public.profiles p on p.id = auth.uid()
    where s.id = public.bookings.session_id
      and (p.role = 'owner' or s.created_by = auth.uid())
  )
);

drop policy if exists "feedback delete by coach or owner" on public.feedback;
create policy "feedback delete by coach or owner" on public.feedback
for delete using (
  coach_id = auth.uid() or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
);
