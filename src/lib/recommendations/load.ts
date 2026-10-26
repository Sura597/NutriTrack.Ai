import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "@/lib/api";
import { costPerServing, type DietaryType, type PricedFood } from "@/lib/recommendations/engine";
import type { LogRow } from "@/lib/data/logs";

interface FoodRow {
  id: string;
  food_name: string;
  category: string;
  dietary_type: DietaryType;
  allergens: string[];
  serving_quantity: number;
  serving_unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  raw_grams_per_serving: number | null;
  food_price_estimates: { region: string; price_per_kg_or_litre: number }[];
}

/** Priced foods for a region; falls back to the 'default' region price per food. */
export async function loadPricedFoods(supabase: SupabaseClient, region: string): Promise<PricedFood[]> {
  const { data, error } = await supabase
    .from("food_database")
    .select(
      "id, food_name, category, dietary_type, allergens, serving_quantity, serving_unit, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, raw_grams_per_serving, food_price_estimates!inner(region, price_per_kg_or_litre)",
    )
    .in("food_price_estimates.region", Array.from(new Set([region, "default"])));
  if (error) dbError(error, "loadPricedFoods");

  const out: PricedFood[] = [];
  for (const r of (data ?? []) as unknown as FoodRow[]) {
    if (!r.raw_grams_per_serving) continue;
    const prices = r.food_price_estimates;
    const price = prices.find((p) => p.region === region) ?? prices.find((p) => p.region === "default");
    if (!price) continue;
    out.push({
      id: r.id,
      food_name: r.food_name,
      category: r.category,
      dietary_type: r.dietary_type,
      allergens: r.allergens ?? [],
      serving_quantity: Number(r.serving_quantity),
      serving_unit: r.serving_unit,
      calories_kcal: Number(r.calories_kcal),
      protein_g: Number(r.protein_g),
      carbs_g: Number(r.carbs_g),
      fat_g: Number(r.fat_g),
      fiber_g: Number(r.fiber_g),
      raw_grams_per_serving: Number(r.raw_grams_per_serving),
      price_per_kg_or_litre: Number(price.price_per_kg_or_litre),
    });
  }
  return out;
}

/**
 * Rough spend so far today, using ONLY items linked to a priced database food
 * (servings ≈ logged kcal ÷ the food's per-serving kcal). Unlinked or AI/manual
 * items have no price and are excluded, so this is a lower bound.
 */
export function estimateSpendInr(logs: LogRow[], foods: PricedFood[], adjustmentPct: number): { spent: number; pricedItems: number; unpricedItems: number } {
  const byId = new Map(foods.map((f) => [f.id, f]));
  let spent = 0;
  let priced = 0;
  let unpriced = 0;
  for (const item of logs.flatMap((l) => l.items)) {
    const f = item.food_database_id ? byId.get(item.food_database_id) : undefined;
    if (!f || f.calories_kcal <= 0) {
      unpriced += 1;
      continue;
    }
    spent += costPerServing(f, adjustmentPct) * (item.calories_kcal / f.calories_kcal);
    priced += 1;
  }
  return { spent: Math.round(spent * 100) / 100, pricedItems: priced, unpricedItems: unpriced };
}
