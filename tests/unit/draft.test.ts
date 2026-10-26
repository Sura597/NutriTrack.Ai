import { describe, it, expect } from "vitest";
import { defaultMealType, draftFromAnalysis, draftFromFood, draftToPayload, draftTotals, manualDraft, rescale } from "@/lib/draft";

const roti = {
  id: "11111111-1111-4111-8111-111111111111",
  food_name: "Roti / chapati (plain)",
  serving_quantity: 1, serving_unit: "piece", unit_grams: { piece: 40 },
  calories_kcal: 102, protein_g: 3.3, carbs_g: 20.7, fat_g: 0.5, fiber_g: 3.3,
  micronutrients: { iron_mg: 1.5 },
};

describe("draftFromFood / rescale (no AI call needed)", () => {
  it("starts at one serving", () => {
    const d = draftFromFood(roti);
    expect(d.quantity).toBe("1");
    expect(d.calories_kcal).toBe("102");
    expect(d.estimation_source).toBe("database");
    expect(d.food_database_id).toBe(roti.id);
  });
  it("rescales exactly when the quantity changes", () => {
    const d = rescale(draftFromFood(roti), "3", "piece");
    expect(d.calories_kcal).toBe("306");
    expect(d.protein_g).toBe("9.9");
    expect(d.micronutrients.iron_mg).toBe(4.5);
  });
  it("converts when the unit changes (80 g of roti = 2 pieces)", () => {
    expect(rescale(draftFromFood(roti), "80", "g").calories_kcal).toBe("204");
  });
  it("warns instead of guessing when a unit can't be converted", () => {
    const d = rescale(draftFromFood(roti), "1", "cup");
    expect(d.warnings.join(" ")).toMatch(/couldn't convert/i);
    expect(d.calories_kcal).toBe("102"); // unchanged, not silently recomputed
  });
  it("ignores non-numeric quantity while typing", () => {
    const d = rescale(draftFromFood(roti), "", "piece");
    expect(d.quantity).toBe("");
    expect(d.calories_kcal).toBe("102");
  });
});

describe("AI estimates rescale proportionally from the original numbers", () => {
  const ai = draftFromAnalysis({
    food_name: "Mixed vegetable curry", quantity: 100, unit: "g",
    calories_kcal: 80, protein_g: 2, carbs_g: 8, fat_g: 4, confidence: 0.5, assumptions: ["cooked with 1 tsp oil"],
  });
  it("keeps the AI source, confidence and assumptions", () => {
    expect(ai.estimation_source).toBe("ai");
    expect(ai.confidence).toBe(0.5);
    expect(ai.assumptions).toEqual(["cooked with 1 tsp oil"]);
  });
  it("scales with quantity in the same unit", () => {
    const d = rescale(ai, "250", "g");
    expect(d.calories_kcal).toBe("200");
    expect(d.fat_g).toBe("10");
  });
  it("does not invent numbers when the unit changes", () => {
    const d = rescale(ai, "1", "cup");
    expect(d.calories_kcal).toBe("80");
  });
});

describe("draftToPayload validation", () => {
  it("accepts a complete database item", () => {
    const r = draftToPayload(draftFromFood(roti));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.item.calories_kcal).toBe(102);
  });
  it("rejects missing name, quantity, calories and negative values", () => {
    const base = draftFromFood(roti);
    expect(draftToPayload({ ...base, food_name: "  " }).ok).toBe(false);
    expect(draftToPayload({ ...base, quantity: "0" }).ok).toBe(false);
    expect(draftToPayload({ ...base, quantity: "abc" }).ok).toBe(false);
    expect(draftToPayload({ ...base, calories_kcal: "" }).ok).toBe(false);
    expect(draftToPayload({ ...base, calories_kcal: "-5" }).ok).toBe(false);
    expect(draftToPayload({ ...base, calories_kcal: "99999" }).ok).toBe(false);
    expect(draftToPayload({ ...base, protein_g: "-1" }).ok).toBe(false);
    expect(draftToPayload({ ...base, unit: "bucket" }).ok).toBe(false);
  });
  it("treats blank macros as zero but requires calories for manual items", () => {
    const m = { ...manualDraft("Chai"), unit: "cup", calories_kcal: "70" };
    const r = draftToPayload(m);
    expect(r.ok && r.item.protein_g).toBe(0);
    expect(draftToPayload(manualDraft("Chai")).ok).toBe(false);
  });
});

describe("draftTotals and defaultMealType", () => {
  it("sums multiple items and ignores blanks", () => {
    const a = draftFromFood(roti, 2);
    const b = { ...manualDraft("x"), calories_kcal: "50", protein_g: "" };
    expect(draftTotals([a, b])).toMatchObject({ kcal: 254 });
  });
  it("picks a meal from the local hour", () => {
    const at = (h: number) => defaultMealType(new Date(2026, 0, 1, h));
    expect([at(8), at(13), at(17), at(21), at(2)]).toEqual(["breakfast", "lunch", "snack", "dinner", "dinner"]);
  });
});
