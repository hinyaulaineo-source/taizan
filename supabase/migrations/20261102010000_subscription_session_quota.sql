-- Monthly session allowances on subscriptions.
-- Bookings consume remaining sessions; cancel/unbook in the current month refunds them.
-- quota_month is the first day of the Hong Kong calendar month this remaining count belongs to.

alter table public.subscriptions
  add column if not exists monthly_session_allowance integer,
  add column if not exists sessions_remaining integer,
  add column if not exists quota_month date;

create or replace function public.default_monthly_sessions(p_tier public.subscription_tier)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'youth_standard' then 4
    when 'youth_elite' then 8
    when 'standard' then 8
    when 'performance_100m' then 12
    when 'performance_400m' then 12
    when 'elite' then 16
    else 8
  end;
$$;

create or replace function public.current_quota_month()
returns date
language sql
stable
as $$
  select (date_trunc('month', timezone('Asia/Hong_Kong', now())))::date;
$$;

create or replace function public.subscriptions_set_quota_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.monthly_session_allowance is null then
    new.monthly_session_allowance := public.default_monthly_sessions(new.tier);
  end if;
  if new.sessions_remaining is null then
    new.sessions_remaining := new.monthly_session_allowance;
  end if;
  if new.quota_month is null then
    new.quota_month := public.current_quota_month();
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_quota_defaults on public.subscriptions;
create trigger subscriptions_quota_defaults
before insert on public.subscriptions
for each row
execute procedure public.subscriptions_set_quota_defaults();

-- Backfill existing rows: remaining = allowance minus bookings made this HK month.
with booked as (
  select
    b.athlete_id,
    count(*)::integer as n
  from public.bookings b
  where b.status = 'booked'
    and ((b.booked_at at time zone 'Asia/Hong_Kong')::date >= public.current_quota_month())
  group by b.athlete_id
)
update public.subscriptions s
set
  monthly_session_allowance = coalesce(s.monthly_session_allowance, public.default_monthly_sessions(s.tier)),
  sessions_remaining = greatest(
    0,
    coalesce(s.monthly_session_allowance, public.default_monthly_sessions(s.tier))
      - coalesce(booked.n, 0)
  ),
  quota_month = coalesce(s.quota_month, public.current_quota_month())
from booked
where s.user_id = booked.athlete_id
  and (s.monthly_session_allowance is null or s.sessions_remaining is null or s.quota_month is null);

update public.subscriptions s
set
  monthly_session_allowance = coalesce(s.monthly_session_allowance, public.default_monthly_sessions(s.tier)),
  sessions_remaining = coalesce(s.sessions_remaining, public.default_monthly_sessions(s.tier)),
  quota_month = coalesce(s.quota_month, public.current_quota_month())
where s.monthly_session_allowance is null
   or s.sessions_remaining is null
   or s.quota_month is null;

alter table public.subscriptions
  alter column monthly_session_allowance set default 8,
  alter column monthly_session_allowance set not null,
  alter column sessions_remaining set default 8,
  alter column sessions_remaining set not null,
  alter column quota_month set default (date_trunc('month', timezone('Asia/Hong_Kong', now())))::date,
  alter column quota_month set not null;

alter table public.subscriptions
  drop constraint if exists subscriptions_monthly_session_allowance_range;
alter table public.subscriptions
  add constraint subscriptions_monthly_session_allowance_range
  check (monthly_session_allowance >= 0 and monthly_session_allowance <= 62);

alter table public.subscriptions
  drop constraint if exists subscriptions_sessions_remaining_range;
alter table public.subscriptions
  add constraint subscriptions_sessions_remaining_range
  check (sessions_remaining >= 0);

create or replace function public.consume_session_quota(p_athlete_id uuid, p_count integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.subscriptions%rowtype;
  month_start date := public.current_quota_month();
begin
  if p_count is null or p_count < 1 then
    return jsonb_build_object('ok', false, 'error', 'Invalid session count.');
  end if;

  select * into r from public.subscriptions where user_id = p_athlete_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'No subscription found.');
  end if;
  if r.status is distinct from 'active' then
    return jsonb_build_object('ok', false, 'error', 'Active subscription required.');
  end if;

  if r.quota_month is null or r.quota_month < month_start then
    r.monthly_session_allowance := coalesce(r.monthly_session_allowance, public.default_monthly_sessions(r.tier));
    r.sessions_remaining := r.monthly_session_allowance;
    r.quota_month := month_start;
  end if;

  if r.sessions_remaining < p_count then
    update public.subscriptions
    set
      monthly_session_allowance = r.monthly_session_allowance,
      sessions_remaining = r.sessions_remaining,
      quota_month = r.quota_month,
      updated_at = now()
    where user_id = p_athlete_id;
    return jsonb_build_object(
      'ok', false,
      'error', 'No monthly sessions remaining.',
      'remaining', r.sessions_remaining,
      'allowance', r.monthly_session_allowance
    );
  end if;

  update public.subscriptions
  set
    monthly_session_allowance = r.monthly_session_allowance,
    sessions_remaining = r.sessions_remaining - p_count,
    quota_month = r.quota_month,
    updated_at = now()
  where user_id = p_athlete_id;

  return jsonb_build_object(
    'ok', true,
    'remaining', r.sessions_remaining - p_count,
    'allowance', r.monthly_session_allowance
  );
end;
$$;

create or replace function public.refund_session_quota(p_athlete_id uuid, p_count integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.subscriptions%rowtype;
  month_start date := public.current_quota_month();
begin
  if p_count is null or p_count < 1 then
    return jsonb_build_object('ok', true, 'remaining', null);
  end if;

  select * into r from public.subscriptions where user_id = p_athlete_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'No subscription found.');
  end if;

  if r.quota_month is null or r.quota_month < month_start then
    r.monthly_session_allowance := coalesce(r.monthly_session_allowance, public.default_monthly_sessions(r.tier));
    r.sessions_remaining := r.monthly_session_allowance;
    r.quota_month := month_start;
  else
    r.sessions_remaining := r.sessions_remaining + p_count;
  end if;

  update public.subscriptions
  set
    monthly_session_allowance = r.monthly_session_allowance,
    sessions_remaining = r.sessions_remaining,
    quota_month = r.quota_month,
    updated_at = now()
  where user_id = p_athlete_id;

  return jsonb_build_object('ok', true, 'remaining', r.sessions_remaining, 'allowance', r.monthly_session_allowance);
end;
$$;

create or replace function public.renew_session_quotas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date := public.current_quota_month();
  updated_count integer;
begin
  update public.subscriptions
  set
    sessions_remaining = monthly_session_allowance,
    quota_month = month_start,
    updated_at = now()
  where quota_month is null or quota_month < month_start;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.renew_session_quota(p_athlete_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date := public.current_quota_month();
  r public.subscriptions%rowtype;
begin
  select * into r from public.subscriptions where user_id = p_athlete_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'No subscription found.');
  end if;

  update public.subscriptions
  set
    sessions_remaining = monthly_session_allowance,
    quota_month = month_start,
    updated_at = now()
  where user_id = p_athlete_id
  returning * into r;

  return jsonb_build_object(
    'ok', true,
    'remaining', r.sessions_remaining,
    'allowance', r.monthly_session_allowance
  );
end;
$$;

revoke all on function public.default_monthly_sessions(public.subscription_tier) from public;
revoke all on function public.current_quota_month() from public;
revoke all on function public.consume_session_quota(uuid, integer) from public;
revoke all on function public.refund_session_quota(uuid, integer) from public;
revoke all on function public.renew_session_quotas() from public;
revoke all on function public.renew_session_quota(uuid) from public;

grant execute on function public.default_monthly_sessions(public.subscription_tier) to authenticated, service_role;
grant execute on function public.current_quota_month() to authenticated, service_role;
grant execute on function public.consume_session_quota(uuid, integer) to service_role;
grant execute on function public.refund_session_quota(uuid, integer) to service_role;
grant execute on function public.renew_session_quotas() to service_role;
grant execute on function public.renew_session_quota(uuid) to service_role;
