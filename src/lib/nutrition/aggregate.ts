export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export interface MacroItem {
  calories_kcal: number | string | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  fiber_g?: number | string | null;
}

export interface MacroTotals {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export const EMPTY_TOTALS: MacroTotals = {
  calories_kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
};

// Postgres numeric columns arrive from PostgREST as numbers or strings.
const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function sumMacros(items: MacroItem[]): MacroTotals {
  const t = { ...EMPTY_TOTALS };
  for (const i of items) {
    t.calories_kcal += num(i.calories_kcal);
    t.protein_g += num(i.protein_g);
    t.carbs_g += num(i.carbs_g);
    t.fat_g += num(i.fat_g);
    t.fiber_g += num(i.fiber_g);
  }
  return {
    calories_kcal: Math.round(t.calories_kcal),
    protein_g: round1(t.protein_g),
    carbs_g: round1(t.carbs_g),
    fat_g: round1(t.fat_g),
    fiber_g: round1(t.fiber_g),
  };
}

/** Remaining = target - consumed. May be negative; that's a tracking number, not a verdict. */
export function remainingCalories(target: number, consumed: number): number {
  return Math.round(target - consumed);
}

export function groupByMeal<T extends { meal_type: MealType; items: MacroItem[] }>(
  logs: T[],
): Record<MealType, { logs: T[]; totals: MacroTotals }> {
  const out = {} as Record<MealType, { logs: T[]; totals: MacroTotals }>;
  for (const m of MEAL_TYPES) {
    const inMeal = logs.filter((l) => l.meal_type === m);
    out[m] = { logs: inMeal, totals: sumMacros(inMeal.flatMap((l) => l.items)) };
  }
  return out;
}
