create table if not exists public.personal_bests (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  metric text not null,
  value numeric not null,
  unit text not null default 's',
  recorded_at timestamptz not null default now(),
  note text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_personal_bests_athlete_recorded_at
  on public.personal_bests(athlete_id, recorded_at desc);

alter table public.personal_bests enable row level security;

drop policy if exists "personal bests read own parent or privileged" on public.personal_bests;
create policy "personal bests read own parent or privileged" on public.personal_bests
for select using (
  athlete_id = auth.uid() or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  ) or
  exists (
    select 1 from public.parent_athlete_links l
    where l.parent_id = auth.uid() and l.athlete_id = personal_bests.athlete_id
  )
);

drop policy if exists "personal bests insert own or privileged" on public.personal_bests;
create policy "personal bests insert own or privileged" on public.personal_bests
for insert with check (
  (
    athlete_id = auth.uid() and
    created_by = auth.uid()
  ) or
  (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('owner', 'coach')
    ) and created_by = auth.uid()
  )
);

drop policy if exists "personal bests update own or privileged" on public.personal_bests;
create policy "personal bests update own or privileged" on public.personal_bests
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
