-- Row Level Security. Users can only touch their own rows.
-- (select auth.uid()) is wrapped so Postgres evaluates it once per statement.

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.food_logs enable row level security;
alter table public.food_log_items enable row level security;
alter table public.user_weight_logs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.food_database enable row level security;
alter table public.food_price_estimates enable row level security;

-- profiles (no delete policy: accounts are removed through the server-side delete flow)
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- user_settings
create policy settings_select_own on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy settings_insert_own on public.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy settings_update_own on public.user_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- nutrition_targets
create policy targets_select_own on public.nutrition_targets for select to authenticated
  using (user_id = (select auth.uid()));
create policy targets_insert_own on public.nutrition_targets for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy targets_update_own on public.nutrition_targets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy targets_delete_own on public.nutrition_targets for delete to authenticated
  using (user_id = (select auth.uid()));

-- food_logs
create policy food_logs_select_own on public.food_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy food_logs_insert_own on public.food_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy food_logs_update_own on public.food_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy food_logs_delete_own on public.food_logs for delete to authenticated
  using (user_id = (select auth.uid()));

-- food_log_items (the composite FK also guarantees item.user_id == log.user_id)
create policy items_select_own on public.food_log_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy items_insert_own on public.food_log_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy items_update_own on public.food_log_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy items_delete_own on public.food_log_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- user_weight_logs
create policy weight_select_own on public.user_weight_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy weight_insert_own on public.user_weight_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy weight_update_own on public.user_weight_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy weight_delete_own on public.user_weight_logs for delete to authenticated
  using (user_id = (select auth.uid()));

-- ai_usage: users may read their own usage; writes only via consume_ai_quota()
create policy ai_usage_select_own on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- shared reference data: readable by signed-in users, writable by nobody via the API
create policy food_database_read on public.food_database for select to authenticated using (true);
create policy food_prices_read on public.food_price_estimates for select to authenticated using (true);
