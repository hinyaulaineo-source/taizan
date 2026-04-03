-- Migrate existing "performance" subscriptions to "performance_100m"
update public.subscriptions
  set tier = 'performance_100m'
  where tier = 'performance';

-- Update sessions: replace "performance" with "performance_100m" in allowed_tiers arrays
update public.sessions
  set allowed_tiers = array_replace(allowed_tiers, 'performance'::subscription_tier, 'performance_100m'::subscription_tier);

-- Update default for sessions.allowed_tiers to include both new tiers
alter table public.sessions
  alter column allowed_tiers
  set default array['standard','performance_100m','performance_400m','elite','youth_standard','youth_elite']::public.subscription_tier[];
