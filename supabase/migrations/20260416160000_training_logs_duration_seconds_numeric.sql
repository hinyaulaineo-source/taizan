alter table public.training_logs
  alter column duration_seconds type numeric using duration_seconds::numeric;
