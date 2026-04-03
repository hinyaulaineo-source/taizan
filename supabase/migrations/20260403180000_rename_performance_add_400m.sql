-- Step 1: Add new enum values
alter type public.subscription_tier add value if not exists 'performance_100m';
alter type public.subscription_tier add value if not exists 'performance_400m';
