-- TAIZAN Athletics MVP schema for Supabase
-- Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('owner', 'coach', 'athlete', 'parent');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type public.session_status as enum ('draft', 'pending', 'published', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'subscription_tier') then
    create type public.subscription_tier as enum ('standard', 'performance', 'elite', 'youth_standard', 'youth_elite');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  sheet_ref_no text,
  role public.user_role not null default 'athlete',
  coach_request_pending boolean not null default false,
  coach_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier public.subscription_tier not null default 'standard',
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  google_sheet_row_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  session_type text not null default 'track_session',
  scheduled_at timestamptz not null,
  location text,
  allowed_tiers public.subscription_tier[] not null default array['standard','performance','elite','youth_standard','youth_elite']::public.subscription_tier[],
  max_athletes integer,
  status public.session_status not null default 'pending',
  created_by uuid not null references public.profiles(id) on delete cascade,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  content_md text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  status text not null default 'booked',
  booked_at timestamptz not null default now(),
  unique(athlete_id, session_id)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_athlete_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(parent_id, athlete_id)
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.sessions enable row level security;
alter table public.programs enable row level security;
alter table public.bookings enable row level security;
alter table public.feedback enable row level security;
alter table public.parent_athlete_links enable row level security;

-- Profiles
drop policy if exists "profiles read own or privileged" on public.profiles;
create policy "profiles read own or privileged" on public.profiles
for select using (
  id = auth.uid() or
  exists (
    select 1 from public.profiles viewer
    where viewer.id = auth.uid() and viewer.role in ('owner', 'coach')
  )
);

drop policy if exists "profiles insert own row" on public.profiles;
create policy "profiles insert own row" on public.profiles
for insert with check (id = auth.uid());

drop policy if exists "profiles update own row or owner" on public.profiles;
create policy "profiles update own row or owner" on public.profiles
for update using (
  id = auth.uid() or
  exists (
    select 1 from public.profiles viewer
    where viewer.id = auth.uid() and viewer.role = 'owner'
  )
);

-- Sessions
drop policy if exists "sessions read by role and status" on public.sessions;
create policy "sessions read by role and status" on public.sessions
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  ) or
  (
    status = 'published' and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('athlete', 'parent')
    )
  )
);

drop policy if exists "sessions insert by coach or owner" on public.sessions;
create policy "sessions insert by coach or owner" on public.sessions
for insert with check (
  auth.uid() = created_by and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  )
);

drop policy if exists "sessions update by owner or creator" on public.sessions;
create policy "sessions update by owner or creator" on public.sessions
for update using (
  created_by = auth.uid() or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
);

-- Subscriptions
drop policy if exists "subscriptions read own or privileged" on public.subscriptions;
create policy "subscriptions read own or privileged" on public.subscriptions
for select using (
  user_id = auth.uid() or
  exists (
    select 1
    from public.parent_athlete_links l
    where l.parent_id = auth.uid()
      and l.athlete_id = public.subscriptions.user_id
  ) or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  )
);

drop policy if exists "subscriptions owner write" on public.subscriptions;
create policy "subscriptions owner write" on public.subscriptions
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
);

-- Programs
drop policy if exists "programs read with session visibility" on public.programs;
create policy "programs read with session visibility" on public.programs
for select using (
  exists (
    select 1 from public.sessions s
    join public.profiles p on p.id = auth.uid()
    where s.id = session_id and (p.role in ('owner', 'coach') or s.status = 'published')
  )
);

drop policy if exists "programs write by owner or coach" on public.programs;
create policy "programs write by owner or coach" on public.programs
for all using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  )
);

-- Bookings
drop policy if exists "bookings read own or parent or privileged" on public.bookings;
create policy "bookings read own or parent or privileged" on public.bookings
for select using (
  athlete_id = auth.uid() or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  ) or
  exists (
    select 1 from public.parent_athlete_links l
    where l.parent_id = auth.uid() and l.athlete_id = bookings.athlete_id
  )
);

drop policy if exists "bookings create by athlete" on public.bookings;
create policy "bookings create by athlete" on public.bookings
for insert with check (athlete_id = auth.uid());

drop policy if exists "bookings create by parent" on public.bookings;
create policy "bookings create by parent" on public.bookings
for insert with check (
  exists (
    select 1
    from public.parent_athlete_links l
    where l.parent_id = auth.uid()
      and l.athlete_id = athlete_id
  )
);

drop policy if exists "bookings update by athlete" on public.bookings;
create policy "bookings update by athlete" on public.bookings
for update
using (athlete_id = auth.uid())
with check (athlete_id = auth.uid());

drop policy if exists "bookings update by parent" on public.bookings;
create policy "bookings update by parent" on public.bookings
for update
using (
  exists (
    select 1 from public.parent_athlete_links l
    where l.parent_id = auth.uid()
      and l.athlete_id = public.bookings.athlete_id
  )
)
with check (
  exists (
    select 1 from public.parent_athlete_links l
    where l.parent_id = auth.uid()
      and l.athlete_id = public.bookings.athlete_id
  )
);

-- Feedback
drop policy if exists "feedback read own parent or privileged" on public.feedback;
create policy "feedback read own parent or privileged" on public.feedback
for select using (
  athlete_id = auth.uid() or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  ) or
  exists (
    select 1 from public.parent_athlete_links l
    where l.parent_id = auth.uid() and l.athlete_id = feedback.athlete_id
  )
);

drop policy if exists "feedback create by coach or owner" on public.feedback;
create policy "feedback create by coach or owner" on public.feedback
for insert with check (
  coach_id = auth.uid() and
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  )
);

-- Parent links
drop policy if exists "parent links read own or privileged" on public.parent_athlete_links;
create policy "parent links read own or privileged" on public.parent_athlete_links
for select using (
  parent_id = auth.uid() or
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'coach')
  )
);

drop policy if exists "parent links owner write" on public.parent_athlete_links;
create policy "parent links owner write" on public.parent_athlete_links
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
);
