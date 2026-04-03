create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  checked_in boolean not null default false,
  marked_by uuid not null references public.profiles(id) on delete cascade,
  marked_at timestamptz not null default now(),
  unique(session_id, athlete_id)
);

alter table public.attendance enable row level security;

drop policy if exists "attendance read by athlete or privileged" on public.attendance;
create policy "attendance read by athlete or privileged" on public.attendance
for select using (
  athlete_id = auth.uid() or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  ) or
  exists (
    select 1 from public.parent_athlete_links l
    where l.parent_id = auth.uid() and l.athlete_id = attendance.athlete_id
  )
);

drop policy if exists "attendance write by coach or owner" on public.attendance;
create policy "attendance write by coach or owner" on public.attendance
for all using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  )
);
