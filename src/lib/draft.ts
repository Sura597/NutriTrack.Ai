import { isUnit, scaleNutrition, type ScalableFood } from "@/lib/nutrition/units";
import type { LogItemInput } from "@/lib/schemas";

/**
 * A food item being reviewed before saving. Numbers are kept as strings while
 * the user types, and parsed/validated only when saving.
 */
export interface DraftItem {
  key: string;
  food_name: string;
  quantity: string;
  unit: string;
  calories_kcal: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  micronutrients: Record<string, number>;
  estimation_source: "database" | "ai" | "manual";
  food_database_id: string | null;
  confidence: number | null;
  assumptions: string[];
  /** Plain-language flags shown on the item (uncertain portion, unit guessed, etc). */
  warnings: string[];
  /** Database foods can be re-scaled exactly when quantity/unit change. */
  food?: ScalableFood & { micronutrients: Record<string, number> };
  /** AI/manual items re-scale proportionally from their original estimate. */
  base?: { quantity: number; unit: string; kcal: number; p: number; c: number; f: number; fib: number; micro: Record<string, number> };
  edited?: boolean;
}

let counter = 0;
export const newKey = () => `d${Date.now().toString(36)}${(counter++).toString(36)}`;

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export function manualDraft(name = ""): DraftItem {
  return {
    key: newKey(), food_name: name, quantity: "1", unit: "piece",
    calories_kcal: "", protein_g: "", carbs_g: "", fat_g: "", fiber_g: "",
    micronutrients: {}, estimation_source: "manual", food_database_id: null,
    confidence: null, assumptions: [], warnings: [],
  };
}

export interface FoodLike extends ScalableFood {
  id: string;
  food_name: string;
  micronutrients: Record<string, number>;
}

export function draftFromFood(food: FoodLike, quantity?: number, unit?: string): DraftItem {
  const q = quantity ?? food.serving_quantity;
  const u = unit ?? food.serving_unit;
  const scaled = scaleNutrition(food, q, u);
  const warnings: string[] = [];
  if (!scaled) warnings.push("We couldn't convert that unit for this food. Check the numbers or pick another unit.");
  else if (scaled.approximate) warnings.push("Household measures like cups and pieces are approximate.");
  const factor = scaled ? scaled.grams / (scaleNutrition(food, food.serving_quantity, food.serving_unit)?.grams || 1) : 1;
  return {
    key: newKey(),
    food_name: food.food_name,
    quantity: fmt(q),
    unit: u,
    calories_kcal: scaled ? String(scaled.calories_kcal) : "",
    protein_g: scaled ? fmt(scaled.protein_g) : "",
    carbs_g: scaled ? fmt(scaled.carbs_g) : "",
    fat_g: scaled ? fmt(scaled.fat_g) : "",
    fiber_g: scaled ? fmt(scaled.fiber_g) : "",
    micronutrients: scaleMicro(food.micronutrients, factor),
    estimation_source: "database",
    food_database_id: food.id,
    confidence: null,
    assumptions: [],
    warnings,
    food: { ...food },
  };
}

function scaleMicro(m: Record<string, number>, factor: number) {
  return Object.fromEntries(Object.entries(m ?? {}).map(([k, v]) => [k, Math.round(Number(v) * factor * 10) / 10]));
}

export interface AiLikeItem {
  food_name: string;
  quantity: number;
  unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  micronutrients?: Record<string, number>;
  confidence?: number | null;
  assumptions?: string[];
  warnings?: string[];
  estimation_source?: "database" | "ai";
  food_database_id?: string | null;
  food?: DraftItem["food"];
}

/** Item produced by the analysis pipeline (database match or AI estimate). */
export function draftFromAnalysis(it: AiLikeItem): DraftItem {
  const base = {
    quantity: it.quantity, unit: it.unit, kcal: it.calories_kcal, p: it.protein_g, c: it.carbs_g, f: it.fat_g,
    fib: it.fiber_g ?? 0, micro: it.micronutrients ?? {},
  };
  return {
    key: newKey(),
    food_name: it.food_name,
    quantity: fmt(it.quantity),
    unit: it.unit,
    calories_kcal: String(Math.round(it.calories_kcal)),
    protein_g: fmt(it.protein_g),
    carbs_g: fmt(it.carbs_g),
    fat_g: fmt(it.fat_g),
    fiber_g: fmt(it.fiber_g ?? 0),
    micronutrients: it.micronutrients ?? {},
    estimation_source: it.estimation_source ?? "ai",
    food_database_id: it.food_database_id ?? null,
    confidence: it.confidence ?? null,
    assumptions: it.assumptions ?? [],
    warnings: it.warnings ?? [],
    food: it.food,
    base,
  };
}

/** Draft built from an already-saved log item (editing). */
export function draftFromSaved(it: {
  food_name: string; quantity: number; unit: string; calories_kcal: number; protein_g: number; carbs_g: number;
  fat_g: number; fiber_g: number; micronutrients: Record<string, number>; estimation_source: "database" | "ai" | "manual";
  food_database_id: string | null; confidence: number | null; assumptions: string[];
}): DraftItem {
  return {
    ...draftFromAnalysis({ ...it, estimation_source: it.estimation_source === "manual" ? undefined : it.estimation_source }),
    estimation_source: it.estimation_source,
  };
}

/**
 * Update the quantity (and optionally unit) and rescale nutrients without any
 * AI call: exactly for database foods, proportionally for AI/manual estimates.
 */
export function rescale(item: DraftItem, quantity: string, unit: string): DraftItem {
  const q = Number(quantity);
  const out: DraftItem = { ...item, quantity, unit, edited: true };
  if (!Number.isFinite(q) || q <= 0) return out;

  if (item.food) {
    const scaled = scaleNutrition(item.food, q, unit);
    if (!scaled) {
      out.warnings = [...item.warnings.filter((w) => !w.startsWith("We couldn't convert")), "We couldn't convert that unit for this food. Check the numbers."];
      return out;
    }
    const servingGrams = scaleNutrition(item.food, item.food.serving_quantity, item.food.serving_unit)?.grams || 1;
    out.calories_kcal = String(scaled.calories_kcal);
    out.protein_g = fmt(scaled.protein_g);
    out.carbs_g = fmt(scaled.carbs_g);
    out.fat_g = fmt(scaled.fat_g);
    out.fiber_g = fmt(scaled.fiber_g);
    out.micronutrients = scaleMicro(item.food.micronutrients, scaled.grams / servingGrams);
    out.warnings = item.warnings.filter((w) => !w.startsWith("We couldn't convert"));
    return out;
  }
  if (item.base && item.base.unit === unit && item.base.quantity > 0) {
    const r = q / item.base.quantity;
    out.calories_kcal = String(Math.round(item.base.kcal * r));
    out.protein_g = fmt(item.base.p * r);
    out.carbs_g = fmt(item.base.c * r);
    out.fat_g = fmt(item.base.f * r);
    out.fiber_g = fmt(item.base.fib * r);
    out.micronutrients = scaleMicro(item.base.micro, r);
  }
  return out;
}

export type DraftResult = { ok: true; item: LogItemInput } | { ok: false; error: string };

export function draftToPayload(d: DraftItem): DraftResult {
  const name = d.food_name.trim();
  if (!name) return { ok: false, error: "Every item needs a name." };
  const q = Number(d.quantity);
  if (!Number.isFinite(q) || q <= 0) return { ok: false, error: `Enter a quantity for ${name}.` };
  if (!isUnit(d.unit)) return { ok: false, error: `Choose a unit for ${name}.` };
  const parse = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const kcal = parse(d.calories_kcal);
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 5000) return { ok: false, error: `Enter calories (0 to 5000) for ${name}.` };
  const macro = (s: string, label: string): number | string => {
    if (s.trim() === "") return 0;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : `Check ${label} for ${name}.`;
  };
  const p = macro(d.protein_g, "protein"), c = macro(d.carbs_g, "carbs"), f = macro(d.fat_g, "fat"), fib = macro(d.fiber_g, "fibre");
  for (const v of [p, c, f, fib]) if (typeof v === "string") return { ok: false, error: v };

  // If the user changed numbers by hand on an AI/database item, record that honestly.
  return {
    ok: true,
    item: {
      food_name: name, quantity: q, unit: d.unit, calories_kcal: kcal,
      protein_g: p as number, carbs_g: c as number, fat_g: f as number, fiber_g: fib as number,
      micronutrients: d.micronutrients, estimation_source: d.estimation_source,
      food_database_id: d.food_database_id, confidence: d.confidence, assumptions: d.assumptions,
    },
  };
}

export function draftTotals(items: DraftItem[]) {
  const n = (s: string) => (Number.isFinite(Number(s)) && s.trim() !== "" ? Number(s) : 0);
  return items.reduce(
    (t, i) => ({ kcal: t.kcal + n(i.calories_kcal), p: t.p + n(i.protein_g), c: t.c + n(i.carbs_g), f: t.f + n(i.fat_g) }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
}

/** Default meal for the current local hour. */
export function defaultMealType(now = new Date()): "breakfast" | "lunch" | "dinner" | "snack" {
  const h = now.getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 19) return "snack";
  return "dinner";
}
