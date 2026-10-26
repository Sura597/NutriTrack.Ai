-- Atomic log writes and food search. These are SECURITY INVOKER (the default):
-- they run as the calling user, so RLS still applies to every statement.

create or replace function public.create_food_log(
  p_consumed_at timestamptz,
  p_meal_type text,
  p_input_method text,
  p_original_input text,
  p_notes text,
  p_image_path text,
  p_items jsonb
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_log uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one item is required' using errcode = '22023';
  end if;

  insert into public.food_logs (user_id, consumed_at, meal_type, input_method, original_input, notes, image_path)
  values (v_uid, coalesce(p_consumed_at, now()), p_meal_type, p_input_method, p_original_input, p_notes, p_image_path)
  returning id into v_log;

  insert into public.food_log_items
    (food_log_id, user_id, food_name, quantity, unit, calories_kcal, protein_g, carbs_g, fat_g, fiber_g,
     micronutrients, estimation_source, food_database_id, confidence, assumptions)
  select v_log, v_uid, i.food_name, i.quantity, i.unit, i.calories_kcal,
         coalesce(i.protein_g, 0), coalesce(i.carbs_g, 0), coalesce(i.fat_g, 0), coalesce(i.fiber_g, 0),
         coalesce(i.micronutrients, '{}'::jsonb), i.estimation_source, i.food_database_id, i.confidence,
         coalesce(i.assumptions, '{}'::text[])
  from jsonb_to_recordset(p_items) as i(
    food_name text, quantity numeric, unit text, calories_kcal numeric, protein_g numeric, carbs_g numeric,
    fat_g numeric, fiber_g numeric, micronutrients jsonb, estimation_source text, food_database_id uuid,
    confidence numeric, assumptions text[]
  );

  return v_log;
end;
$$;

create or replace function public.update_food_log(
  p_id uuid,
  p_consumed_at timestamptz,
  p_meal_type text,
  p_set_notes boolean,
  p_notes text,
  p_items jsonb
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.food_logs
     set consumed_at = coalesce(p_consumed_at, consumed_at),
         meal_type = coalesce(p_meal_type, meal_type),
         notes = case when p_set_notes then p_notes else notes end
   where id = p_id and user_id = v_uid;
  if not found then
    raise exception 'log not found' using errcode = 'P0002';
  end if;

  if p_items is not null then
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      raise exception 'at least one item is required' using errcode = '22023';
    end if;
    delete from public.food_log_items where food_log_id = p_id and user_id = v_uid;
    insert into public.food_log_items
      (food_log_id, user_id, food_name, quantity, unit, calories_kcal, protein_g, carbs_g, fat_g, fiber_g,
       micronutrients, estimation_source, food_database_id, confidence, assumptions)
    select p_id, v_uid, i.food_name, i.quantity, i.unit, i.calories_kcal,
           coalesce(i.protein_g, 0), coalesce(i.carbs_g, 0), coalesce(i.fat_g, 0), coalesce(i.fiber_g, 0),
           coalesce(i.micronutrients, '{}'::jsonb), i.estimation_source, i.food_database_id, i.confidence,
           coalesce(i.assumptions, '{}'::text[])
    from jsonb_to_recordset(p_items) as i(
      food_name text, quantity numeric, unit text, calories_kcal numeric, protein_g numeric, carbs_g numeric,
      fat_g numeric, fiber_g numeric, micronutrients jsonb, estimation_source text, food_database_id uuid,
      confidence numeric, assumptions text[]
    );
  end if;
end;
$$;

-- Food search over names and aliases (exact > prefix > contains > fuzzy).
create or replace function public.search_foods(p_query text, p_limit integer default 12)
returns setof public.food_database
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select lower(btrim(regexp_replace(p_query, '[^a-zA-Z0-9 ]+', ' ', 'g'))) as t
  )
  select f.*
  from public.food_database f, q
  where q.t <> '' and (
    f.normalized_name like '%' || q.t || '%'
    or exists (select 1 from unnest(f.aliases) a where a like '%' || q.t || '%')
    or similarity(f.normalized_name, q.t) > 0.3
  )
  order by
    (f.normalized_name = q.t or q.t = any (f.aliases)) desc,
    (f.normalized_name like q.t || '%' or exists (select 1 from unnest(f.aliases) a where a like q.t || '%')) desc,
    similarity(f.normalized_name, q.t) desc,
    f.food_name
  limit least(greatest(p_limit, 1), 30);
$$;

revoke all on function public.create_food_log(timestamptz, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.update_food_log(uuid, timestamptz, text, boolean, text, jsonb) from public, anon;
revoke all on function public.search_foods(text, integer) from public, anon;
grant execute on function public.create_food_log(timestamptz, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.update_food_log(uuid, timestamptz, text, boolean, text, jsonb) to authenticated;
grant execute on function public.search_foods(text, integer) to authenticated;
