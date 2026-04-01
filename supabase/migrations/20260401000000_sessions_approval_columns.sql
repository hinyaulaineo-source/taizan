-- Align existing databases with app code: session approval audit fields.
-- Safe to run multiple times (IF NOT EXISTS).

alter table public.sessions
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;
