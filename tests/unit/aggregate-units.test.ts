import { describe, it, expect } from "vitest";
import { groupByMeal, remainingCalories, sumMacros } from "@/lib/nutrition/aggregate";
import { scaleNutrition, toGrams, type ScalableFood } from "@/lib/nutrition/units";

describe("sumMacros", () => {
  it("adds multiple items in one meal", () => {
    const t = sumMacros([
      { calories_kcal: 204, protein_g: 6.6, carbs_g: 41.4, fat_g: 1, fiber_g: 6.6 },
      { calories_kcal: 187, protein_g: 9, carbs_g: 22, fat_g: 7, fiber_g: 4.5 },
      { calories_kcal: 195, protein_g: 4, carbs_g: 42, fat_g: 0.5, fiber_g: 0.6 },
    ]);
    expect(t).toEqual({ calories_kcal: 586, protein_g: 19.6, carbs_g: 105.4, fat_g: 8.5, fiber_g: 11.7 });
  });
  it("accepts numeric strings from Postgres and ignores nulls", () => {
    const t = sumMacros([{ calories_kcal: "100.5", protein_g: "2", carbs_g: null, fat_g: "1.25" }]);
    expect(t.calories_kcal).toBe(101);
    expect(t.protein_g).toBe(2);
    expect(t.carbs_g).toBe(0);
    expect(t.fat_g).toBe(1.3);
  });
  it("returns zeros for no items", () => {
    expect(sumMacros([]).calories_kcal).toBe(0);
  });
});

describe("remainingCalories", () => {
  it("is target minus consumed and may be negative", () => {
    expect(remainingCalories(2000, 1500)).toBe(500);
    expect(remainingCalories(2000, 2300)).toBe(-300);
    expect(remainingCalories(2000, 2000)).toBe(0);
  });
});

describe("groupByMeal", () => {
  it("groups logs and totals each meal separately", () => {
    const g = groupByMeal([
      { meal_type: "breakfast" as const, items: [{ calories_kcal: 200, protein_g: 5, carbs_g: 30, fat_g: 5 }] },
      { meal_type: "breakfast" as const, items: [{ calories_kcal: 100, protein_g: 1, carbs_g: 20, fat_g: 1 }] },
      { meal_type: "dinner" as const, items: [{ calories_kcal: 500, protein_g: 20, carbs_g: 60, fat_g: 15 }] },
    ]);
    expect(g.breakfast.totals.calories_kcal).toBe(300);
    expect(g.breakfast.logs).toHaveLength(2);
    expect(g.dinner.totals.protein_g).toBe(20);
    expect(g.lunch.logs).toHaveLength(0);
    expect(g.snack.totals.calories_kcal).toBe(0);
  });
});

const roti: ScalableFood = {
  serving_quantity: 1, serving_unit: "piece", unit_grams: { piece: 40, plate: 120 },
  calories_kcal: 102, protein_g: 3.3, carbs_g: 20.7, fat_g: 0.5, fiber_g: 3.3,
};
const rice: ScalableFood = {
  serving_quantity: 150, serving_unit: "g", unit_grams: { cup: 160, katori: 150 },
  calories_kcal: 195, protein_g: 4, carbs_g: 42, fat_g: 0.5, fiber_g: 0.6,
};
const milk: ScalableFood = {
  serving_quantity: 240, serving_unit: "ml", unit_grams: { glass: 240 },
  calories_kcal: 140, protein_g: 7.4, carbs_g: 11.3, fat_g: 7.2, fiber_g: 0,
};

describe("toGrams", () => {
  it("converts mass and volume units", () => {
    expect(toGrams(2, "kg", null)).toEqual({ grams: 2000, approximate: false });
    expect(toGrams(250, "ml", null)).toEqual({ grams: 250, approximate: true });
  });
  it("uses per-food household units and flags them approximate", () => {
    expect(toGrams(2, "piece", { piece: 40 })).toEqual({ grams: 80, approximate: true });
  });
  it("returns null instead of guessing an unknown unit", () => {
    expect(toGrams(1, "cup", { piece: 40 })).toBeNull();
    expect(toGrams(1, "cup", null)).toBeNull();
  });
  it("rejects negative or non-finite quantities", () => {
    expect(toGrams(-1, "g", null)).toBeNull();
    expect(toGrams(NaN, "g", null)).toBeNull();
  });
});

describe("scaleNutrition", () => {
  it("scales by pieces", () => {
    const s = scaleNutrition(roti, 3, "piece")!;
    expect(s.calories_kcal).toBe(306);
    expect(s.protein_g).toBe(9.9);
  });
  it("scales by grams and by household units", () => {
    expect(scaleNutrition(rice, 300, "g")!.calories_kcal).toBe(390);
    expect(scaleNutrition(rice, 1, "cup")!.calories_kcal).toBe(Math.round(195 * (160 / 150)));
  });
  it("converts between different units of the same food", () => {
    // 80 g of roti = 2 pieces
    expect(scaleNutrition(roti, 80, "g")!.calories_kcal).toBe(204);
  });
  it("marks ml-based portions as approximate", () => {
    const s = scaleNutrition(milk, 1, "glass")!;
    expect(s.calories_kcal).toBe(140);
    expect(s.approximate).toBe(true);
  });
  it("returns null when the unit can't be resolved for the food", () => {
    expect(scaleNutrition(roti, 1, "cup")).toBeNull();
  });
  it("scales to zero for zero quantity", () => {
    expect(scaleNutrition(rice, 0, "g")!.calories_kcal).toBe(0);
  });
});
