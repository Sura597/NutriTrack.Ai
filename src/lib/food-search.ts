import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScalableFood } from "@/lib/nutrition/units";

export interface FoodHit extends ScalableFood {
  id: string;
  food_name: string;
  category: string;
  dietary_type: "vegan" | "vegetarian" | "eggetarian" | "non_vegetarian";
  allergens: string[];
  micronutrients: Record<string, number>;
  source: string;
}

// The food table is shared, read-only reference data, so a short in-memory cache
// (per server instance) is safe and saves repeated lookups while users type.
const CACHE = new Map<string, { at: number; hits: FoodHit[] }>();
const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;

const num = (v: unknown) => Number(v ?? 0);

export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function searchFoods(supabase: SupabaseClient, rawQuery: string, limit = 12): Promise<FoodHit[]> {
  const q = normalizeQuery(rawQuery);
  if (q.length < 2) return [];
  const key = `${q}|${limit}`;
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.hits;

  const { data, error } = await supabase.rpc("search_foods", { p_query: q, p_limit: limit });
  if (error) throw error;
  const hits: FoodHit[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    food_name: r.food_name as string,
    category: r.category as string,
    dietary_type: r.dietary_type as FoodHit["dietary_type"],
    allergens: (r.allergens as string[]) ?? [],
    serving_quantity: num(r.serving_quantity),
    serving_unit: r.serving_unit as string,
    unit_grams: (r.unit_grams as Record<string, number>) ?? {},
    calories_kcal: num(r.calories_kcal),
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
    fiber_g: num(r.fiber_g),
    micronutrients: (r.micronutrients as Record<string, number>) ?? {},
    source: r.source as string,
  }));

  if (CACHE.size >= MAX_ENTRIES) CACHE.delete(CACHE.keys().next().value as string);
  CACHE.set(key, { at: Date.now(), hits });
  return hits;
}
