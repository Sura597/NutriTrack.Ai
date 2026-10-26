import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "@/lib/api";
import { addDays, dayRange, todayIn } from "@/lib/dates";
import { loadTargets } from "@/lib/data/profile";
import { RANGE_DAYS, buildSeries, computeStats, type DailyRow, type InsightRange } from "@/lib/insights/stats";

const n = (v: unknown) => Number(v ?? 0);

export async function loadInsights(supabase: SupabaseClient, userId: string, tz: string, range: InsightRange, endDate?: string) {
  const to = endDate ?? todayIn(tz);
  const from = addDays(to, -(RANGE_DAYS[range] - 1));
  const start = dayRange(from, tz).start.toISOString();
  const end = dayRange(to, tz).end.toISOString();

  const [daily, top, meals, targets] = await Promise.all([
    supabase.rpc("daily_nutrition", { p_from: start, p_to: end, p_tz: tz }),
    supabase.rpc("top_foods", { p_from: start, p_to: end, p_limit: 8 }),
    supabase.rpc("meal_type_totals", { p_from: start, p_to: end }),
    loadTargets(supabase, userId),
  ]);
  if (daily.error) dbError(daily.error, "daily_nutrition");
  if (top.error) dbError(top.error, "top_foods");
  if (meals.error) dbError(meals.error, "meal_type_totals");

  const rows: DailyRow[] = ((daily.data ?? []) as Record<string, unknown>[]).map((r) => ({
    day: String(r.day),
    meals: n(r.meals),
    calories_kcal: n(r.calories_kcal),
    protein_g: n(r.protein_g),
    carbs_g: n(r.carbs_g),
    fat_g: n(r.fat_g),
    fiber_g: n(r.fiber_g),
  }));
  const series = buildSeries(from, to, rows);
  return {
    range,
    from,
    to,
    series,
    stats: computeStats(series, targets),
    targets: targets ? { calories_kcal: targets.calories_kcal, protein_g: targets.protein_g, carbs_g: targets.carbs_g, fat_g: targets.fat_g } : null,
    top_foods: ((top.data ?? []) as Record<string, unknown>[]).map((r) => ({ food_name: String(r.food_name), times: n(r.times), avg_kcal: n(r.avg_kcal) })),
    meal_split: ((meals.data ?? []) as Record<string, unknown>[]).map((r) => ({ meal_type: String(r.meal_type), calories_kcal: n(r.calories_kcal) })),
  };
}
