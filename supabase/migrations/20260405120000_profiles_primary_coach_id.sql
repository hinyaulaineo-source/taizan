-- Primary coach assignment for athletes (one coach per athlete).
alter table public.profiles
  add column if not exists primary_coach_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_profiles_primary_coach_id
  on public.profiles (primary_coach_id)
  where primary_coach_id is not null;
