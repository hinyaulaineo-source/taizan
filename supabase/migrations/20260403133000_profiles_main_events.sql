alter table public.profiles
add column if not exists main_events text[] not null default '{}'::text[];
