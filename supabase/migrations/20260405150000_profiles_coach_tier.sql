-- Coach staff tier (owner-managed); only meaningful when role = coach.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'coach_tier') then
    create type public.coach_tier as enum ('senior_coach', 'coach_assistant', 'junior_coach');
  end if;
end $$;

alter table public.profiles
  add column if not exists coach_tier public.coach_tier;

update public.profiles
set coach_tier = 'senior_coach'
where role = 'coach' and coach_tier is null;
