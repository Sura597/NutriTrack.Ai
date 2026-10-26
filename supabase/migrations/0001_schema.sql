-- NutriTrack AI: core schema
-- Run order: 0001 (schema) -> 0002 (RLS) -> 0003 (storage) -> 0004/0005 (seed data)

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  date_of_birth date check (date_of_birth is null or (date_of_birth > date '1900-01-01' and date_of_birth <= current_date)),
  -- used only for the Mifflin-St Jeor constant; optional, user may skip
  sex text check (sex in ('male', 'female')),
  height_cm numeric(5,1) check (height_cm between 50 and 250),
  current_weight_kg numeric(5,1) check (current_weight_kg between 20 and 400),
  target_weight_kg numeric(5,1) check (target_weight_kg between 20 and 400),
  activity_level text not null default 'light'
    check (activity_level in ('sedentary', 'light', 'moderate', 'very_active')),
  goal text not null default 'maintain' check (goal in ('lose', 'maintain', 'gain')),
  dietary_preference text not null default 'vegetarian'
    check (dietary_preference in ('vegetarian', 'vegan', 'eggetarian', 'non_vegetarian')),
  allergies text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  daily_budget_inr numeric(8,2) check (daily_budget_inr is null or daily_budget_inr between 0 and 100000),
  food_preferences text check (char_length(food_preferences) <= 500),
  cooking_facilities text[] not null default '{}',
  -- sensitive: only used to withhold prescriptive targets; never sent to AI providers
  pregnant_or_breastfeeding boolean not null default false,
  has_medical_condition boolean not null default false,
  eating_disorder_history boolean not null default false,
  region text not null default 'default',
  onboarding_completed boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  preferred_units text not null default 'metric' check (preferred_units in ('metric')),
  time_zone text not null default 'Asia/Kolkata',
  notification_preferences jsonb not null default '{}'::jsonb,
  privacy_preferences jsonb not null default '{"store_food_images": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- nutrition_targets (saved, user-adjustable)
-- ---------------------------------------------------------------------------
create table public.nutrition_targets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calories_kcal numeric(6,0) check (calories_kcal between 500 and 8000),
  protein_g numeric(5,0) check (protein_g between 0 and 500),
  carbs_g numeric(5,0) check (carbs_g between 0 and 1000),
  fat_g numeric(5,0) check (fat_g between 0 and 400),
  fiber_g numeric(4,0) check (fiber_g between 0 and 150),
  micronutrients jsonb not null default '{}'::jsonb,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger nutrition_targets_touch before update on public.nutrition_targets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- food_database (shared, read-only reference data)
-- ---------------------------------------------------------------------------
create table public.food_database (
  id uuid primary key default gen_random_uuid(),
  food_name text not null,
  normalized_name text not null unique,
  aliases text[] not null default '{}',
  category text not null,
  dietary_type text not null check (dietary_type in ('vegan', 'vegetarian', 'eggetarian', 'non_vegetarian')),
  allergens text[] not null default '{}',
  -- nutrient values below are for ONE serving of (serving_quantity serving_unit)
  serving_quantity numeric(8,2) not null check (serving_quantity > 0),
  serving_unit text not null,
  -- grams (or ml) per household unit for this food, e.g. {"piece": 40, "katori": 150}
  unit_grams jsonb not null default '{}'::jsonb,
  calories_kcal numeric(7,1) not null check (calories_kcal >= 0),
  protein_g numeric(6,1) not null check (protein_g >= 0),
  carbs_g numeric(6,1) not null check (carbs_g >= 0),
  fat_g numeric(6,1) not null check (fat_g >= 0),
  fiber_g numeric(6,1) not null default 0 check (fiber_g >= 0),
  -- only keys we have reasonable data for (iron_mg, calcium_mg, vitamin_c_mg, vitamin_d_iu, vitamin_b12_mcg)
  micronutrients jsonb not null default '{}'::jsonb,
  -- as-purchased grams (or ml) needed to make one serving; used for cost estimates
  raw_grams_per_serving numeric(8,1) check (raw_grams_per_serving is null or raw_grams_per_serving > 0),
  source text not null,
  updated_at timestamptz not null default now()
);
create index food_database_name_trgm on public.food_database using gin (normalized_name gin_trgm_ops);
create index food_database_aliases_gin on public.food_database using gin (aliases);
create index food_database_category_idx on public.food_database (category);

-- ---------------------------------------------------------------------------
-- food_price_estimates (configurable, regional)
-- ---------------------------------------------------------------------------
create table public.food_price_estimates (
  id uuid primary key default gen_random_uuid(),
  food_database_id uuid not null references public.food_database (id) on delete cascade,
  region text not null default 'default',
  price_per_kg_or_litre numeric(8,2) not null check (price_per_kg_or_litre > 0),
  currency text not null default 'INR',
  source text not null,
  observed_at timestamptz not null default now(),
  unique (food_database_id, region)
);

-- ---------------------------------------------------------------------------
-- food_logs + food_log_items
-- ---------------------------------------------------------------------------
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consumed_at timestamptz not null default now(),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  input_method text not null check (input_method in ('photo', 'text', 'voice', 'manual')),
  image_path text,
  original_input text check (char_length(original_input) <= 2000),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- lets food_log_items reference (id, user_id) so ownership is enforced by the database itself
  unique (id, user_id)
);
create index food_logs_user_consumed_idx on public.food_logs (user_id, consumed_at desc);
create trigger food_logs_touch before update on public.food_logs
  for each row execute function public.touch_updated_at();

create table public.food_log_items (
  id uuid primary key default gen_random_uuid(),
  food_log_id uuid not null,
  user_id uuid not null,
  food_name text not null check (char_length(food_name) between 1 and 200),
  quantity numeric(8,2) not null check (quantity > 0 and quantity <= 100000),
  unit text not null check (char_length(unit) between 1 and 20),
  calories_kcal numeric(7,1) not null check (calories_kcal between 0 and 5000),
  protein_g numeric(6,1) not null default 0 check (protein_g between 0 and 500),
  carbs_g numeric(6,1) not null default 0 check (carbs_g between 0 and 1000),
  fat_g numeric(6,1) not null default 0 check (fat_g between 0 and 500),
  fiber_g numeric(6,1) not null default 0 check (fiber_g between 0 and 200),
  micronutrients jsonb not null default '{}'::jsonb,
  estimation_source text not null check (estimation_source in ('database', 'ai', 'manual')),
  food_database_id uuid references public.food_database (id) on delete set null,
  confidence numeric(3,2) check (confidence is null or confidence between 0 and 1),
  assumptions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (food_log_id, user_id) references public.food_logs (id, user_id) on delete cascade
);
create index food_log_items_user_idx on public.food_log_items (user_id, created_at desc);
create index food_log_items_log_idx on public.food_log_items (food_log_id);
create trigger food_log_items_touch before update on public.food_log_items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- user_weight_logs (measured weight, kept separate from estimated intake)
-- ---------------------------------------------------------------------------
create table public.user_weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 400),
  notes text check (char_length(notes) <= 500)
);
create index user_weight_logs_user_idx on public.user_weight_logs (user_id, measured_at desc);

-- ---------------------------------------------------------------------------
-- ai_usage: audit + rate limiting for expensive AI endpoints
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

-- Atomically checks the rolling-24h quota and records a call. Returns true if allowed.
-- SECURITY DEFINER so clients cannot insert/delete usage rows themselves.
create or replace function public.consume_ai_quota(p_endpoint text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    return false;
  end if;
  -- serialise per user so concurrent requests cannot overshoot the limit
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select count(*) into used from public.ai_usage
    where user_id = uid and created_at > now() - interval '24 hours';
  if used >= p_limit then
    return false;
  end if;
  insert into public.ai_usage (user_id, endpoint) values (uid, left(p_endpoint, 60));
  return true;
end;
$$;
revoke all on function public.consume_ai_quota(text, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- new-user bootstrap: create profile + settings rows
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, terms_accepted_at)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80), ''),
    case when new.raw_user_meta_data ->> 'terms_accepted' = 'true' then now() end
  )
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
