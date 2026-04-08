-- Mobile phone on profile (normalized digits-only storage for uniqueness + login password mapping).
alter table public.profiles
  add column if not exists phone text;

create unique index if not exists idx_profiles_phone_unique
  on public.profiles (phone)
  where phone is not null;
