import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, dbError } from "@/lib/api";
import { consumedAtFor, dayRange } from "@/lib/dates";
import { groupByMeal, remainingCalories, sumMacros, type MacroTotals, type MealType } from "@/lib/nutrition/aggregate";
import type { CreateLogInput, LogItemInput } from "@/lib/schemas";
import { loadTargets, type TargetsRow } from "@/lib/data/profile";

export interface ItemRow {
  id: string;
  food_log_id: string;
  food_name: string;
  quantity: number;
  unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  micronutrients: Record<string, number>;
  estimation_source: "database" | "ai" | "manual";
  food_database_id: string | null;
  confidence: number | null;
  assumptions: string[];
}

export interface LogRow {
  id: string;
  consumed_at: string;
  meal_type: MealType;
  input_method: "photo" | "text" | "voice" | "manual";
  image_path: string | null;
  original_input: string | null;
  notes: string | null;
  items: ItemRow[];
}

const LOG_SELECT = "id, consumed_at, meal_type, input_method, image_path, original_input, notes, items:food_log_items(*)";

const n = (v: unknown) => Number(v ?? 0);

function normalizeLog(r: Record<string, unknown>): LogRow {
  const items = ((r.items as Record<string, unknown>[]) ?? [])
    .map((i) => ({
      ...(i as unknown as ItemRow),
      quantity: n(i.quantity),
      calories_kcal: n(i.calories_kcal),
      protein_g: n(i.protein_g),
      carbs_g: n(i.carbs_g),
      fat_g: n(i.fat_g),
      fiber_g: n(i.fiber_g),
      confidence: i.confidence === null || i.confidence === undefined ? null : n(i.confidence),
      micronutrients: (i.micronutrients as Record<string, number>) ?? {},
      assumptions: (i.assumptions as string[]) ?? [],
    }))
    .sort((a, b) => a.food_name.localeCompare(b.food_name));
  return { ...(r as unknown as LogRow), items };
}

export async function fetchLogsForDay(supabase: SupabaseClient, tz: string, date: string): Promise<LogRow[]> {
  const { start, end } = dayRange(date, tz);
  const { data, error } = await supabase
    .from("food_logs")
    .select(LOG_SELECT)
    .gte("consumed_at", start.toISOString())
    .lt("consumed_at", end.toISOString())
    .order("consumed_at", { ascending: true });
  if (error) dbError(error, "fetch day logs");
  return (data ?? []).map(normalizeLog);
}

export async function fetchLog(supabase: SupabaseClient, id: string): Promise<LogRow | null> {
  const { data, error } = await supabase.from("food_logs").select(LOG_SELECT).eq("id", id).maybeSingle();
  if (error) dbError(error, "fetch log");
  return data ? normalizeLog(data) : null;
}

export async function fetchLogsPage(
  supabase: SupabaseClient,
  tz: string,
  opts: { date?: string; from?: string; to?: string; page: number; pageSize: number },
) {
  let q = supabase.from("food_logs").select(LOG_SELECT, { count: "exact" });
  if (opts.date) {
    const { start, end } = dayRange(opts.date, tz);
    q = q.gte("consumed_at", start.toISOString()).lt("consumed_at", end.toISOString());
  } else {
    if (opts.from) q = q.gte("consumed_at", dayRange(opts.from, tz).start.toISOString());
    if (opts.to) q = q.lt("consumed_at", dayRange(opts.to, tz).end.toISOString());
  }
  const from = (opts.page - 1) * opts.pageSize;
  const { data, error, count } = await q
    .order("consumed_at", { ascending: false })
    .range(from, from + opts.pageSize - 1);
  if (error) dbError(error, "list logs");
  return { logs: (data ?? []).map(normalizeLog), total: count ?? 0 };
}

const itemsForRpc = (items: LogItemInput[]) =>
  items.map((i) => ({
    ...i,
    food_database_id: i.food_database_id ?? null,
    confidence: i.confidence ?? null,
  }));

export async function createLog(supabase: SupabaseClient, userId: string, tz: string, input: CreateLogInput): Promise<string> {
  if (input.image_path && !input.image_path.startsWith(`${userId}/`)) {
    throw new ApiError(400, "invalid_image_path", "That image doesn't belong to your account.");
  }
  const consumedAt = consumedAtFor(input.date, tz, input.meal_type);
  const { data, error } = await supabase.rpc("create_food_log", {
    p_consumed_at: consumedAt.toISOString(),
    p_meal_type: input.meal_type,
    p_input_method: input.input_method,
    p_original_input: input.original_input ?? null,
    p_notes: input.notes ?? null,
    p_image_path: input.image_path ?? null,
    p_items: itemsForRpc(input.items),
  });
  if (error) dbError(error, "create log");
  return data as string;
}

export async function updateLog(
  supabase: SupabaseClient,
  tz: string,
  id: string,
  patch: { meal_type?: MealType; notes?: string | null; date?: string; items?: LogItemInput[] },
  currentMealType: MealType,
) {
  const meal = patch.meal_type ?? currentMealType;
  const { error } = await supabase.rpc("update_food_log", {
    p_id: id,
    p_consumed_at: patch.date ? consumedAtFor(patch.date, tz, meal).toISOString() : null,
    p_meal_type: patch.meal_type ?? null,
    p_set_notes: patch.notes !== undefined,
    p_notes: patch.notes ?? null,
    p_items: patch.items ? itemsForRpc(patch.items) : null,
  });
  if (error) {
    if (error.code === "P0002") throw new ApiError(404, "not_found", "That meal wasn't found.");
    dbError(error, "update log");
  }
}

export interface MicronutrientTotal {
  total: number;
  /** Items that reported a value for this nutrient. */
  items_with_data: number;
}

export interface DaySummary {
  date: string;
  totals: MacroTotals;
  by_meal: Record<MealType, MacroTotals>;
  targets: TargetsRow | null;
  remaining_kcal: number | null;
  item_count: number;
  meal_count: number;
  micronutrients: Record<string, MicronutrientTotal>;
}

export function summarize(date: string, logs: LogRow[], targets: TargetsRow | null): DaySummary {
  const items = logs.flatMap((l) => l.items);
  const totals = sumMacros(items);
  const grouped = groupByMeal(logs);
  const micro: Record<string, MicronutrientTotal> = {};
  for (const item of items) {
    for (const [k, v] of Object.entries(item.micronutrients ?? {})) {
      const m = (micro[k] ??= { total: 0, items_with_data: 0 });
      m.total = Math.round((m.total + Number(v)) * 10) / 10;
      m.items_with_data += 1;
    }
  }
  return {
    date,
    totals,
    by_meal: {
      breakfast: grouped.breakfast.totals,
      lunch: grouped.lunch.totals,
      dinner: grouped.dinner.totals,
      snack: grouped.snack.totals,
    },
    targets,
    remaining_kcal: targets?.calories_kcal ? remainingCalories(targets.calories_kcal, totals.calories_kcal) : null,
    item_count: items.length,
    meal_count: logs.length,
    micronutrients: micro,
  };
}

export async function daySummary(supabase: SupabaseClient, userId: string, tz: string, date: string) {
  const [logs, targets] = await Promise.all([fetchLogsForDay(supabase, tz, date), loadTargets(supabase, userId)]);
  return { logs, summary: summarize(date, logs, targets) };
}
