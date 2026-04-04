-- Stripe identifiers for webhook upserts
alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

-- Idempotent session reminder sends (24h window cron)
create table if not exists public.session_reminder_sent (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique(session_id, athlete_id)
);

alter table public.session_reminder_sent enable row level security;

-- No policies: authenticated users get no rows; service role bypasses RLS for server cron.
