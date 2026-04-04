-- Allow coaches and owners to create bookings on behalf of athletes
drop policy if exists "bookings create by coach or owner" on public.bookings;
create policy "bookings create by coach or owner" on public.bookings
for insert with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coach', 'owner')
  )
);

-- Allow coaches and owners to update bookings (needed for upsert)
drop policy if exists "bookings update by coach or owner" on public.bookings;
create policy "bookings update by coach or owner" on public.bookings
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coach', 'owner')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coach', 'owner')
  )
);
