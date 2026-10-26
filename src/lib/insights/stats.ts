import { dateSpan } from "@/lib/dates";

export interface DailyRow {
  day: string;
  meals: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface DayPoint extends DailyRow {
  logged: boolean;
}

export interface InsightStats {
  days_in_range: number;
  days_logged: number;
  avg_calories_kcal: number | null;
  avg_protein_g: number | null;
  avg_carbs_g: number | null;
  avg_fat_g: number | null;
  /** Share of logged days that reached ≥90% of the protein target; null without a target or logged days. */
  protein_target_days: number | null;
  calorie_target_days_within_10pct: number | null;
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** One point per calendar day in [from, to]; days without logs are flagged, NOT counted as zero intake. */
export function buildSeries(from: string, to: string, rows: DailyRow[]): DayPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return dateSpan(from, to).map((day) => {
    const r = byDay.get(day);
    return r
      ? { ...r, logged: true }
      : { day, meals: 0, calories_kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, logged: false };
  });
}

/** Averages use logged days only, so skipping a day isn't mistaken for fasting. */
export function computeStats(
  series: DayPoint[],
  targets: { calories_kcal: number | null; protein_g: number | null } | null,
): InsightStats {
  const logged = series.filter((d) => d.logged);
  const proteinDays =
    targets?.protein_g && logged.length ? logged.filter((d) => d.protein_g >= 0.9 * targets.protein_g!).length : null;
  const calDays =
    targets?.calories_kcal && logged.length
      ? logged.filter((d) => Math.abs(d.calories_kcal - targets.calories_kcal!) <= 0.1 * targets.calories_kcal!).length
      : null;
  return {
    days_in_range: series.length,
    days_logged: logged.length,
    avg_calories_kcal: avg(logged.map((d) => d.calories_kcal)),
    avg_protein_g: avg(logged.map((d) => d.protein_g)),
    avg_carbs_g: avg(logged.map((d) => d.carbs_g)),
    avg_fat_g: avg(logged.map((d) => d.fat_g)),
    protein_target_days: proteinDays,
    calorie_target_days_within_10pct: calDays,
  };
}

export const RANGE_DAYS = { day: 1, week: 7, month: 30 } as const;
export type InsightRange = keyof typeof RANGE_DAYS;
