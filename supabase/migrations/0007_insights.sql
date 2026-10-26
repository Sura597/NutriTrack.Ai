-- Personal price adjustment (regional prices live in food_price_estimates; this is a per-user % tweak).
alter table public.profiles
  add column if not exists price_adjustment_pct numeric(5,1) not null default 0
  check (price_adjustment_pct between -50 and 200);

-- Per-day totals over a range, grouped by the user's LOCAL calendar day. SECURITY INVOKER: RLS applies.
create or replace function public.daily_nutrition(p_from timestamptz, p_to timestamptz, p_tz text)
returns table (day date, meals bigint, items bigint, calories_kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric, fiber_g numeric)
language sql stable
set search_path = ''
as $$
  select (l.consumed_at at time zone p_tz)::date as day,
         count(distinct l.id), count(i.id),
         coalesce(sum(i.calories_kcal), 0), coalesce(sum(i.protein_g), 0), coalesce(sum(i.carbs_g), 0),
         coalesce(sum(i.fat_g), 0), coalesce(sum(i.fiber_g), 0)
  from public.food_logs l
  join public.food_log_items i on i.food_log_id = l.id and i.user_id = l.user_id
  where l.user_id = auth.uid() and l.consumed_at >= p_from and l.consumed_at < p_to
  group by 1
  order by 1;
$$;

-- Most frequently logged foods in a range.
create or replace function public.top_foods(p_from timestamptz, p_to timestamptz, p_limit integer default 8)
returns table (food_name text, times bigint, avg_kcal numeric)
language sql stable
set search_path = ''
as $$
  select i.food_name, count(*) as times, round(avg(i.calories_kcal))
  from public.food_log_items i
  join public.food_logs l on l.id = i.food_log_id and l.user_id = i.user_id
  where l.user_id = auth.uid() and l.consumed_at >= p_from and l.consumed_at < p_to
  group by i.food_name
  order by count(*) desc, i.food_name
  limit least(greatest(p_limit, 1), 20);
$$;

-- Calories by meal type in a range.
create or replace function public.meal_type_totals(p_from timestamptz, p_to timestamptz)
returns table (meal_type text, calories_kcal numeric)
language sql stable
set search_path = ''
as $$
  select l.meal_type, coalesce(sum(i.calories_kcal), 0)
  from public.food_logs l
  join public.food_log_items i on i.food_log_id = l.id and i.user_id = l.user_id
  where l.user_id = auth.uid() and l.consumed_at >= p_from and l.consumed_at < p_to
  group by l.meal_type;
$$;

revoke all on function public.daily_nutrition(timestamptz, timestamptz, text) from public, anon;
revoke all on function public.top_foods(timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.meal_type_totals(timestamptz, timestamptz) from public, anon;
grant execute on function public.daily_nutrition(timestamptz, timestamptz, text) to authenticated;
grant execute on function public.top_foods(timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.meal_type_totals(timestamptz, timestamptz) to authenticated;
