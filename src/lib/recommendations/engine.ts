/**
 * Affordable-food recommendation engine (pure functions, no I/O).
 *
 * Cost of one serving = price per kg (or litre) × as-purchased grams per serving / 1000,
 * then scaled by the user's price adjustment. Prices are rough estimates, not live
 * market data; the UI says so.
 */

export type DietaryType = "vegan" | "vegetarian" | "eggetarian" | "non_vegetarian";

const DIET_RANK: Record<DietaryType, number> = { vegan: 0, vegetarian: 1, eggetarian: 2, non_vegetarian: 3 };

export const RECOMMENDATION_FILTERS = [
  "cheapest_protein",
  "vegetarian",
  "high_protein",
  "fits_calories",
  "fits_budget",
] as const;
export type RecommendationFilter = (typeof RECOMMENDATION_FILTERS)[number];

export interface PricedFood {
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
  raw_grams_per_serving: number;
  price_per_kg_or_litre: number;
}

export interface Recommendation {
  food_id: string;
  food_name: string;
  category: string;
  dietary_type: DietaryType;
  serving: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  cost_per_serving_inr: number;
  /** null when the food has too little protein for the figure to mean anything. */
  cost_per_10g_protein_inr: number | null;
  why: string;
  prep_tip: string | null;
}

export interface RecommendationInput {
  foods: PricedFood[];
  diet: DietaryType;
  allergies: string[];
  filters: RecommendationFilter[];
  remainingKcal: number | null;
  remainingBudgetInr: number | null;
  priceAdjustmentPct: number;
  limit?: number;
}

const MIN_PROTEIN_FOR_COST_METRIC = 3;
const HIGH_PROTEIN_G = 10;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function dietAllows(userDiet: DietaryType, foodDiet: DietaryType): boolean {
  return DIET_RANK[foodDiet] <= DIET_RANK[userDiet];
}

export function costPerServing(food: Pick<PricedFood, "price_per_kg_or_litre" | "raw_grams_per_serving">, adjustmentPct = 0): number {
  const base = (food.price_per_kg_or_litre * food.raw_grams_per_serving) / 1000;
  return round2(base * (1 + adjustmentPct / 100));
}

/** Short, non-medical explanation of why an item is suggested. */
export function whyText(r: Pick<Recommendation, "protein_g" | "fiber_g" | "calories_kcal" | "cost_per_10g_protein_inr" | "cost_per_serving_inr">): string {
  const parts: string[] = [];
  if (r.protein_g >= HIGH_PROTEIN_G) parts.push(`${round1(r.protein_g)} g protein per serving`);
  if (r.cost_per_10g_protein_inr !== null && r.cost_per_10g_protein_inr <= 15) parts.push("low cost for the protein");
  if (r.fiber_g >= 4) parts.push("good fibre");
  if (r.calories_kcal <= 120) parts.push("light on calories");
  if (parts.length === 0) parts.push(`an inexpensive option at about ₹${Math.round(r.cost_per_serving_inr)} a serving`);
  return parts.join(", ").replace(/^./, (c) => c.toUpperCase()) + ".";
}

const PREP_TIPS: Record<string, string> = {
  pulses: "Soak for a few hours, then pressure cook; add a squeeze of lemon at the end.",
  legumes: "Soak overnight and boil or pressure cook; sprouting adds variety for little cost.",
  dairy: "Plain curd or paneer is easy to add to any meal without cooking.",
  eggs: "Boil a batch at once and keep them refrigerated for quick meals.",
  vegetables: "Buy what is in season and lightly sauté or steam to keep the fibre and flavour.",
  grains: "Batch-cook and refrigerate; pair with a pulse or curd to round out the protein.",
  nuts: "A small handful goes a long way; dry roast at home instead of buying packaged.",
};

export function prepTipFor(category: string): string | null {
  return PREP_TIPS[category.toLowerCase()] ?? null;
}

export function recommend(input: RecommendationInput): Recommendation[] {
  const { foods, diet, allergies, filters, remainingKcal, remainingBudgetInr, priceAdjustmentPct } = input;
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 50);
  const blocked = new Set(allergies.map((a) => a.toLowerCase()));

  let rows = foods
    .filter((f) => dietAllows(diet, f.dietary_type))
    .filter((f) => !f.allergens.some((a) => blocked.has(a.toLowerCase())))
    .filter((f) => f.raw_grams_per_serving > 0 && f.price_per_kg_or_litre > 0)
    .map((f): Recommendation => {
      const cost = costPerServing(f, priceAdjustmentPct);
      const cost10 = f.protein_g >= MIN_PROTEIN_FOR_COST_METRIC ? round2((cost / f.protein_g) * 10) : null;
      const base = {
        food_id: f.id,
        food_name: f.food_name,
        category: f.category,
        dietary_type: f.dietary_type,
        serving: `${f.serving_quantity} ${f.serving_unit}`,
        calories_kcal: Math.round(f.calories_kcal),
        protein_g: round1(f.protein_g),
        carbs_g: round1(f.carbs_g),
        fat_g: round1(f.fat_g),
        fiber_g: round1(f.fiber_g),
        cost_per_serving_inr: cost,
        cost_per_10g_protein_inr: cost10,
      };
      return { ...base, why: whyText(base), prep_tip: prepTipFor(f.category) };
    });

  const wants = new Set(filters);
  if (wants.has("vegetarian")) rows = rows.filter((r) => r.dietary_type === "vegan" || r.dietary_type === "vegetarian");
  if (wants.has("high_protein")) rows = rows.filter((r) => r.protein_g >= HIGH_PROTEIN_G);
  if (wants.has("fits_calories") && remainingKcal !== null) rows = rows.filter((r) => r.calories_kcal <= Math.max(remainingKcal, 0));
  if (wants.has("fits_budget") && remainingBudgetInr !== null) rows = rows.filter((r) => r.cost_per_serving_inr <= Math.max(remainingBudgetInr, 0));
  if (wants.has("cheapest_protein")) rows = rows.filter((r) => r.cost_per_10g_protein_inr !== null);

  // Best protein value first; protein-poor foods (no metric) after, ties by price.
  rows.sort((a, b) => {
    const d = (a.cost_per_10g_protein_inr ?? Infinity) - (b.cost_per_10g_protein_inr ?? Infinity);
    if (d !== 0 && Number.isFinite(d)) return d;
    if (a.cost_per_10g_protein_inr === null && b.cost_per_10g_protein_inr !== null) return 1;
    if (b.cost_per_10g_protein_inr === null && a.cost_per_10g_protein_inr !== null) return -1;
    return a.cost_per_serving_inr - b.cost_per_serving_inr || a.food_name.localeCompare(b.food_name);
  });
  return rows.slice(0, limit);
}
