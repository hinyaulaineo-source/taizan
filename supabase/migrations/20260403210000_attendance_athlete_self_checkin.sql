drop policy if exists "attendance self check-in by athlete" on public.attendance;
create policy "attendance self check-in by athlete" on public.attendance
for insert with check (
  athlete_id = auth.uid() and marked_by = auth.uid()
);

drop policy if exists "attendance self update by athlete" on public.attendance;
create policy "attendance self update by athlete" on public.attendance
for update using (
  athlete_id = auth.uid() and marked_by = auth.uid()
) with check (
  athlete_id = auth.uid() and marked_by = auth.uid()
);
