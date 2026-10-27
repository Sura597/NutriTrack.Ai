import { describe, it, expect } from "vitest";
import { FOODS } from "../../scripts/seed/foods.mjs";
import { generateDayPlan, type PlanFood } from "@/lib/diet-plan/engine";
import { costPerServing } from "@/lib/recommendations/engine";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const foods: PlanFood[] = (FOODS as unknown[][]).map((r) => ({
  id: norm(String(r[0])),
  normalized_name: norm(String(r[0])),
  food_name: String(r[0]),
  dietary_type: r[3] as PlanFood["dietary_type"],
  allergens: r[4] as string[],
  serving_quantity: Number(r[5]),
  serving_unit: String(r[6]),
  calories_kcal: Number(r[8]),
  protein_g: Number(r[9]),
  carbs_g: Number(r[10]),
  fat_g: Number(r[11]),
  fiber_g: Number(r[12]),
  cost_per_serving_inr: r[14] && r[15] ? costPerServing({ price_per_kg_or_litre: Number(r[15]), raw_grams_per_serving: Number(r[14]) }) : null,
}));

describe("diet plan against the real seed food table", () => {
  const diets = ["vegan", "vegetarian", "eggetarian", "non_vegetarian"] as const;
  const targets = [1400, 1800, 2200, 2800];
  for (const diet of diets) {
    for (const targetKcal of targets) {
      it(`${diet} at ${targetKcal} kcal: four meals, close to target, no forbidden foods`, () => {
        for (let variant = 0; variant < 6; variant++) {
          const p = generateDayPlan({ foods, diet, allergies: [], targetKcal, targetProteinG: Math.round(targetKcal * 0.03), dailyBudgetInr: null, variant });
          expect(p.slots).toHaveLength(4);
          const gap = Math.abs(p.totals.calories_kcal - targetKcal) / targetKcal;
          expect(gap).toBeLessThan(0.25);
          // Large gaps (limited by portion caps and diet) must be disclosed, never hidden.
          if (gap > 0.12) expect(p.notes.join(" ")).toMatch(/below|above/);
          const order = { vegan: 0, vegetarian: 1, eggetarian: 2, non_vegetarian: 3 };
          for (const i of p.slots.flatMap((s) => s.items)) {
            const food = foods.find((x) => x.id === i.food_id)!;
            expect(order[food.dietary_type]).toBeLessThanOrEqual(order[diet]);
          }
        }
      });
    }
  }
  it("respects every allergen option", () => {
    for (const allergen of ["gluten", "dairy", "egg", "peanut", "tree_nut", "soy", "fish", "shellfish"]) {
      for (let variant = 0; variant < 6; variant++) {
        const p = generateDayPlan({ foods, diet: "non_vegetarian", allergies: [allergen], targetKcal: 2000, targetProteinG: 60, dailyBudgetInr: null, variant });
        for (const i of p.slots.flatMap((s) => s.items)) {
          expect(foods.find((x) => x.id === i.food_id)!.allergens).not.toContain(allergen);
        }
      }
    }
  });
});
