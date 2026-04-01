do $$
begin
  alter type public.subscription_tier add value if not exists 'standard';
exception when duplicate_object then null;
end $$;

do $$
begin
  alter type public.subscription_tier add value if not exists 'youth_standard';
exception when duplicate_object then null;
end $$;

do $$
begin
  alter type public.subscription_tier add value if not exists 'youth_elite';
exception when duplicate_object then null;
end $$;

-- Migrate legacy starter users/sessions to standard.
update public.subscriptions
set tier = 'standard'
where tier::text = 'starter';

update public.sessions
set allowed_tiers = array_replace(allowed_tiers, 'starter'::public.subscription_tier, 'standard'::public.subscription_tier)
where 'starter'::public.subscription_tier = any(allowed_tiers);

alter table public.subscriptions
  alter column tier set default 'standard';

alter table public.sessions
  alter column allowed_tiers set default
    array['standard','performance','elite','youth_standard','youth_elite']::public.subscription_tier[];
