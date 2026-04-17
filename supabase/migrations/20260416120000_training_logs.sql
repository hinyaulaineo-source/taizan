create table if not exists public.training_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  logged_at timestamptz not null default now(),
  distance_km numeric not null,
  duration_seconds numeric not null,
  running_percent numeric not null,
  note text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint training_logs_distance_positive check (distance_km > 0),
  constraint training_logs_duration_positive check (duration_seconds > 0),
  constraint training_logs_running_percent_range check (running_percent >= 0 and running_percent <= 100)
);

create index if not exists idx_training_logs_athlete_logged_at
  on public.training_logs(athlete_id, logged_at desc);

alter table public.training_logs enable row level security;

drop policy if exists "training logs read own parent or privileged" on public.training_logs;
create policy "training logs read own parent or privileged" on public.training_logs
for select using (
  athlete_id = auth.uid() or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  ) or
  exists (
    select 1 from public.parent_athlete_links l
    where l.parent_id = auth.uid() and l.athlete_id = training_logs.athlete_id
  )
);

drop policy if exists "training logs insert own or privileged" on public.training_logs;
create policy "training logs insert own or privileged" on public.training_logs
for insert with check (
  (
    athlete_id = auth.uid() and created_by = auth.uid()
  ) or
  (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'coach')
    ) and created_by = auth.uid()
  )
);

drop policy if exists "training logs update own or privileged" on public.training_logs;
create policy "training logs update own or privileged" on public.training_logs
for update using (
  (
    athlete_id = auth.uid() and created_by = auth.uid()
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  )
)
with check (
  (
    athlete_id = auth.uid() and created_by = auth.uid()
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  )
);
