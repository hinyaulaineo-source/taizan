alter table public.profiles
  add column if not exists coach_request_pending boolean not null default false,
  add column if not exists coach_requested_at timestamptz;
