import { describe, it, expect } from "vitest";
import { costPerServing, dietAllows, recommend, type PricedFood } from "@/lib/recommendations/engine";
import { buildSeries, computeStats } from "@/lib/insights/stats";

const food = (o: Partial<PricedFood>): PricedFood => ({
  id: o.food_name ?? "x",
  food_name: "Food",
  category: "pulses",
  dietary_type: "vegan",
  allergens: [],
  serving_quantity: 1,
  serving_unit: "katori",
  calories_kcal: 150,
  protein_g: 9,
  carbs_g: 20,
  fat_g: 2,
  fiber_g: 5,
  raw_grams_per_serving: 40,
  price_per_kg_or_litre: 100,
  ...o,
});

const base = { diet: "non_vegetarian" as const, allergies: [], filters: [], remainingKcal: null, remainingBudgetInr: null, priceAdjustmentPct: 0 };

describe("costPerServing", () => {
  it("is price/kg × raw grams / 1000, with adjustment", () => {
    expect(costPerServing({ price_per_kg_or_litre: 120, raw_grams_per_serving: 50 })).toBe(6);
    expect(costPerServing({ price_per_kg_or_litre: 120, raw_grams_per_serving: 50 }, 10)).toBe(6.6);
  });
});

describe("recommend", () => {
  const foods = [
    food({ food_name: "Dal", price_per_kg_or_litre: 120, protein_g: 9 }),
    food({ food_name: "Paneer", dietary_type: "vegetarian", allergens: ["dairy"], price_per_kg_or_litre: 400, protein_g: 14 }),
    food({ food_name: "Chicken", dietary_type: "non_vegetarian", price_per_kg_or_litre: 250, protein_g: 25, raw_grams_per_serving: 100 }),
    food({ food_name: "Cucumber", category: "vegetables", protein_g: 0.5, calories_kcal: 15, price_per_kg_or_litre: 40 }),
  ];

  it("never returns foods outside the diet or containing a declared allergen", () => {
    const veg = recommend({ ...base, foods, diet: "vegetarian" }).map((r) => r.food_name);
    expect(veg).not.toContain("Chicken");
    const vegan = recommend({ ...base, foods, diet: "vegan" }).map((r) => r.food_name);
    expect(vegan).toEqual(expect.not.arrayContaining(["Chicken", "Paneer"]));
    const noDairy = recommend({ ...base, foods, allergies: ["dairy"] }).map((r) => r.food_name);
    expect(noDairy).not.toContain("Paneer");
  });
  it("sorts cheapest protein first and omits the metric for protein-poor foods", () => {
    const r = recommend({ ...base, foods, filters: ["cheapest_protein"] });
    expect(r.map((x) => x.food_name)).toEqual(["Dal", "Chicken", "Paneer"]);
    const all = recommend({ ...base, foods });
    expect(all.find((x) => x.food_name === "Cucumber")?.cost_per_10g_protein_inr).toBeNull();
  });
  it("applies calorie and budget fit filters", () => {
    expect(recommend({ ...base, foods, filters: ["fits_calories"], remainingKcal: 100 }).map((r) => r.food_name)).toEqual(["Cucumber"]);
    const cheap = recommend({ ...base, foods, filters: ["fits_budget"], remainingBudgetInr: 2 });
    expect(cheap.every((r) => r.cost_per_serving_inr <= 2)).toBe(true);
    expect(recommend({ ...base, foods, filters: ["fits_budget"], remainingBudgetInr: 0 })).toEqual([]);
  });
  it("high_protein and vegetarian filters", () => {
    expect(recommend({ ...base, foods, filters: ["high_protein"] }).map((r) => r.food_name)).not.toContain("Dal");
    expect(recommend({ ...base, foods, filters: ["vegetarian"] }).map((r) => r.food_name)).not.toContain("Chicken");
  });
  it("dietAllows is ordered", () => {
    expect(dietAllows("vegan", "vegetarian")).toBe(false);
    expect(dietAllows("eggetarian", "vegetarian")).toBe(true);
  });
});

describe("insight stats", () => {
  const row = (day: string, kcal: number, protein: number) => ({ day, meals: 2, calories_kcal: kcal, protein_g: protein, carbs_g: 0, fat_g: 0, fiber_g: 0 });
  it("fills missing days as not-logged and excludes them from averages", () => {
    const s = buildSeries("2026-03-01", "2026-03-04", [row("2026-03-01", 2000, 60), row("2026-03-03", 1000, 30)]);
    expect(s.map((d) => d.logged)).toEqual([true, false, true, false]);
    const st = computeStats(s, { calories_kcal: 2000, protein_g: 60 });
    expect(st.days_logged).toBe(2);
    expect(st.avg_calories_kcal).toBe(1500);
    expect(st.protein_target_days).toBe(1);
    expect(st.calorie_target_days_within_10pct).toBe(1);
  });
  it("returns nulls with no data or targets", () => {
    const st = computeStats(buildSeries("2026-03-01", "2026-03-02", []), null);
    expect(st.avg_calories_kcal).toBeNull();
    expect(st.protein_target_days).toBeNull();
  });
});
