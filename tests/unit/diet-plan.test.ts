import { describe, it, expect } from "vitest";
import { generateDayPlan, type PlanFood } from "@/lib/diet-plan/engine";

const f = (name: string, o: Partial<PlanFood> = {}): PlanFood => ({
  id: name,
  normalized_name: name,
  food_name: name,
  dietary_type: "vegan",
  allergens: [],
  serving_quantity: 1,
  serving_unit: "piece",
  calories_kcal: 100,
  protein_g: 4,
  carbs_g: 15,
  fat_g: 2,
  fiber_g: 2,
  cost_per_serving_inr: 5,
  ...o,
});

const FOODS: PlanFood[] = [
  f("poha cooked", { serving_unit: "g", serving_quantity: 150, calories_kcal: 230 }),
  f("boiled egg", { dietary_type: "eggetarian", allergens: ["egg"], calories_kcal: 75, protein_g: 6.3 }),
  f("moong sprouts", { serving_unit: "g", serving_quantity: 100, calories_kcal: 48 }),
  f("banana", { calories_kcal: 89 }),
  f("roti chapati plain", { calories_kcal: 102 }),
  f("cooked white rice", { serving_unit: "g", serving_quantity: 150, calories_kcal: 195 }),
  f("dal tadka", { dietary_type: "vegetarian", serving_unit: "g", serving_quantity: 150, calories_kcal: 187, protein_g: 9 }),
  f("chicken curry", { dietary_type: "non_vegetarian", serving_unit: "g", serving_quantity: 150, calories_kcal: 222, protein_g: 18 }),
  f("rajma curry", { serving_unit: "g", serving_quantity: 150, calories_kcal: 198, protein_g: 9 }),
  f("mixed vegetable sabzi", { serving_unit: "g", serving_quantity: 100, calories_kcal: 82 }),
  f("curd dahi", { dietary_type: "vegetarian", allergens: ["dairy"], serving_unit: "g", serving_quantity: 100, calories_kcal: 60 }),
  f("green salad cucumber tomato onion", { serving_unit: "g", serving_quantity: 100, calories_kcal: 22 }),
  f("roasted chana", { serving_unit: "g", serving_quantity: 30, calories_kcal: 110, protein_g: 6 }),
  f("guava", { calories_kcal: 68 }),
];
const base = { foods: FOODS, diet: "non_vegetarian" as const, allergies: [], targetKcal: 1800, targetProteinG: 60, dailyBudgetInr: null, variant: 0 };
const names = (p: ReturnType<typeof generateDayPlan>) => p.slots.flatMap((s) => s.items.map((i) => i.food_name));

describe("generateDayPlan", () => {
  it("builds four meals that land near the calorie target", () => {
    const p = generateDayPlan({ ...base, targetKcal: 1800 });
    expect(p.slots.map((s) => s.meal_type)).toEqual(["breakfast", "lunch", "snack", "dinner"]);
    expect(Math.abs(p.totals.calories_kcal - 1800)).toBeLessThan(450);
    expect(p.slots.every((s) => s.items.length >= 2)).toBe(true);
  });
  it("totals equal the sum of the item values", () => {
    const p = generateDayPlan(base);
    expect(p.totals.calories_kcal).toBe(p.slots.reduce((a, s) => a + s.totals.calories_kcal, 0));
  });
  it("never includes foods outside the diet or with a declared allergen", () => {
    for (let v = 0; v < 12; v++) {
      const veg = names(generateDayPlan({ ...base, diet: "vegetarian", variant: v }));
      expect(veg).not.toContain("chicken curry");
      expect(veg).not.toContain("boiled egg");
      const vegan = names(generateDayPlan({ ...base, diet: "vegan", variant: v }));
      expect(vegan).not.toContain("curd dahi");
      expect(vegan).not.toContain("dal tadka");
      const noDairy = names(generateDayPlan({ ...base, allergies: ["dairy", "egg"], variant: v }));
      expect(noDairy).not.toContain("curd dahi");
      expect(noDairy).not.toContain("boiled egg");
    }
  });
  it("rotates choices with the variant", () => {
    const a = names(generateDayPlan({ ...base, variant: 0 })).join("|");
    const b = names(generateDayPlan({ ...base, variant: 1 })).join("|");
    expect(a).not.toBe(b);
  });
  it("sizes larger targets with larger portions and uses whole pieces for roti", () => {
    const small = generateDayPlan({ ...base, targetKcal: 1400 });
    const big = generateDayPlan({ ...base, targetKcal: 2600 });
    expect(big.totals.calories_kcal).toBeGreaterThan(small.totals.calories_kcal);
    for (const i of big.slots.flatMap((s) => s.items).filter((i) => i.food_name === "roti chapati plain")) {
      expect(Number.isInteger(i.quantity)).toBe(true);
    }
  });
  it("flags budget and missing prices honestly", () => {
    const p = generateDayPlan({ ...base, dailyBudgetInr: 5 });
    expect(p.notes.join(" ")).toMatch(/above your ₹5 budget/);
    const unpriced = generateDayPlan({ ...base, foods: FOODS.map((x) => ({ ...x, cost_per_serving_inr: null })) });
    expect(unpriced.unpriced_items).toBeGreaterThan(0);
    expect(unpriced.notes.join(" ")).toMatch(/no price estimate/);
  });
  it("copes with a diet that leaves some meals empty", () => {
    const p = generateDayPlan({ ...base, foods: [f("banana")], diet: "vegan" });
    expect(p.slots.length).toBeGreaterThan(0);
    expect(p.notes.join(" ")).toMatch(/couldn't be built/);
  });
});
