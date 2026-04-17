drop policy if exists "training logs delete own or privileged" on public.training_logs;
create policy "training logs delete own or privileged" on public.training_logs
for delete using (
  athlete_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  )
);
