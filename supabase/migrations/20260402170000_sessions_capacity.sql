alter table public.sessions
  add column if not exists max_athletes integer;
