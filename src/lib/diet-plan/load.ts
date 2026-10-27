import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "@/lib/api";
import { costPerServing, type DietaryType } from "@/lib/recommendations/engine";
import type { PlanFood } from "@/lib/diet-plan/engine";

interface Row {
  id: string;
  normalized_name: string;
  food_name: string;
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

export async function loadPlanFoods(supabase: SupabaseClient, region: string, adjustmentPct: number): Promise<PlanFood[]> {
  const { data, error } = await supabase
    .from("food_database")
    .select(
      "id, normalized_name, food_name, dietary_type, allergens, serving_quantity, serving_unit, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, raw_grams_per_serving, food_price_estimates(region, price_per_kg_or_litre)",
    )
    .limit(500);
  if (error) dbError(error, "loadPlanFoods");
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const price = r.food_price_estimates?.find((p) => p.region === region) ?? r.food_price_estimates?.find((p) => p.region === "default");
    return {
      id: r.id,
      normalized_name: r.normalized_name,
      food_name: r.food_name,
      dietary_type: r.dietary_type,
      allergens: r.allergens ?? [],
      serving_quantity: Number(r.serving_quantity),
      serving_unit: r.serving_unit,
      calories_kcal: Number(r.calories_kcal),
      protein_g: Number(r.protein_g),
      carbs_g: Number(r.carbs_g),
      fat_g: Number(r.fat_g),
      fiber_g: Number(r.fiber_g),
      cost_per_serving_inr:
        price && r.raw_grams_per_serving
          ? costPerServing({ price_per_kg_or_litre: Number(price.price_per_kg_or_litre), raw_grams_per_serving: Number(r.raw_grams_per_serving) }, adjustmentPct)
          : null,
    };
  });
}
