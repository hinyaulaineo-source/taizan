-- RLS on profiles must not use "EXISTS (SELECT ... FROM profiles)" inside profiles policies
-- (Postgres: infinite recursion). These helpers read profiles with SECURITY DEFINER.

-- 1) Functions (run as database owner; bypass RLS on the inner SELECT)
create or replace function public.profiles_role(user_id uuid)
returns public.user_role
language plpgsql
security definer
set search_path to public
stable
as $fn$
begin
  return (select p.role from public.profiles p where p.id = user_id limit 1);
end;
$fn$;

create or replace function public.profiles_primary_coach_id(user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to public
stable
as $fn$
begin
  return (select p.primary_coach_id from public.profiles p where p.id = user_id limit 1);
end;
$fn$;

revoke all on function public.profiles_role(uuid) from PUBLIC;
revoke all on function public.profiles_primary_coach_id(uuid) from PUBLIC;

grant execute on function public.profiles_role(uuid) to authenticated;
grant execute on function public.profiles_role(uuid) to service_role;
grant execute on function public.profiles_primary_coach_id(uuid) to authenticated;
grant execute on function public.profiles_primary_coach_id(uuid) to service_role;

-- 2) Policies
drop policy if exists "profiles read own or privileged" on public.profiles;
create policy "profiles read own or privileged" on public.profiles
for select using (
  id = auth.uid()
  or public.profiles_role(auth.uid()) in ('owner', 'coach')
);

drop policy if exists "profiles read assigned coach as athlete" on public.profiles;
create policy "profiles read assigned coach as athlete" on public.profiles
for select using (
  public.profiles_role(auth.uid()) = 'athlete'
  and public.profiles_primary_coach_id(auth.uid()) = profiles.id
);

drop policy if exists "profiles update own row or owner" on public.profiles;
create policy "profiles update own row or owner" on public.profiles
for update
using (
  id = auth.uid()
  or public.profiles_role(auth.uid()) = 'owner'
)
with check (
  id = auth.uid()
  or public.profiles_role(auth.uid()) = 'owner'
);

drop policy if exists "profiles delete by owner" on public.profiles;
create policy "profiles delete by owner" on public.profiles
for delete using (public.profiles_role(auth.uid()) = 'owner');
