alter table public.profiles
  add column if not exists sheet_ref_no text;

create index if not exists profiles_sheet_ref_no_idx on public.profiles (sheet_ref_no);
