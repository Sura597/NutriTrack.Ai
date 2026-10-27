-- Water tracking: one row per drink, plus a personal daily goal.

alter table public.profiles
  add column if not exists water_goal_ml integer not null default 2500
  check (water_goal_ml between 500 and 8000);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consumed_at timestamptz not null default now(),
  amount_ml integer not null check (amount_ml between 10 and 3000),
  created_at timestamptz not null default now()
);
create index water_logs_user_idx on public.water_logs (user_id, consumed_at desc);

alter table public.water_logs enable row level security;
create policy water_select_own on public.water_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy water_insert_own on public.water_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy water_delete_own on public.water_logs for delete to authenticated
  using (user_id = (select auth.uid()));
grant select, insert, delete on public.water_logs to authenticated;

-- Daily totals by the user's LOCAL calendar day. SECURITY INVOKER: RLS applies.
create or replace function public.daily_water(p_from timestamptz, p_to timestamptz, p_tz text)
returns table (day date, total_ml bigint)
language sql stable
set search_path = ''
as $$
  select (w.consumed_at at time zone p_tz)::date, sum(w.amount_ml)::bigint
  from public.water_logs w
  where w.user_id = auth.uid() and w.consumed_at >= p_from and w.consumed_at < p_to
  group by 1
  order by 1;
$$;
revoke all on function public.daily_water(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.daily_water(timestamptz, timestamptz, text) to authenticated;
