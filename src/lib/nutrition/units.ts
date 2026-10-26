export const MASS_VOLUME_UNITS = ["g", "kg", "ml", "l"] as const;
export const HOUSEHOLD_UNITS = ["piece", "cup", "bowl", "katori", "tbsp", "tsp", "slice", "glass", "plate"] as const;
export const ALL_UNITS = [...MASS_VOLUME_UNITS, ...HOUSEHOLD_UNITS] as const;
export type Unit = (typeof ALL_UNITS)[number];

export interface NutrientValues {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

/** Shape of a food_database row that is needed to scale a portion. */
export interface ScalableFood extends NutrientValues {
  serving_quantity: number;
  serving_unit: string;
  /** Grams (or ml) per household unit, e.g. {"piece": 40, "cup": 150}. */
  unit_grams: Record<string, number> | null;
}

export interface ScaledPortion extends NutrientValues {
  grams: number;
  /** True if we treated millilitres as grams (density 1), which is only roughly right. */
  approximate: boolean;
}

const MASS_FACTOR: Record<string, number> = { g: 1, kg: 1000, ml: 1, l: 1000 };

export function isUnit(u: string): u is Unit {
  return (ALL_UNITS as readonly string[]).includes(u);
}

/**
 * Convert a quantity in `unit` to grams (or ml treated as grams).
 * Returns null when the unit can't be resolved for this food, so callers can
 * ask the user instead of silently guessing a quantity.
 */
export function toGrams(
  quantity: number,
  unit: string,
  unitGrams: Record<string, number> | null,
): { grams: number; approximate: boolean } | null {
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  if (unit in MASS_FACTOR) {
    return { grams: quantity * MASS_FACTOR[unit], approximate: unit === "ml" || unit === "l" };
  }
  const per = unitGrams?.[unit];
  if (per === undefined || per <= 0) return null;
  return { grams: quantity * per, approximate: true };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Scale a food's per-serving nutrition to the requested portion. */
export function scaleNutrition(
  food: ScalableFood,
  quantity: number,
  unit: string,
): ScaledPortion | null {
  const requested = toGrams(quantity, unit, food.unit_grams);
  const serving = toGrams(food.serving_quantity, food.serving_unit, food.unit_grams);
  if (!requested || !serving || serving.grams <= 0) return null;

  const factor = requested.grams / serving.grams;
  return {
    grams: round1(requested.grams),
    approximate: requested.approximate || serving.approximate,
    calories_kcal: Math.round(food.calories_kcal * factor),
    protein_g: round1(food.protein_g * factor),
    carbs_g: round1(food.carbs_g * factor),
    fat_g: round1(food.fat_g * factor),
    fiber_g: round1(food.fiber_g * factor),
  };
}
