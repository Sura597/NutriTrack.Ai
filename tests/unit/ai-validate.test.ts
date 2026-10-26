import { describe, it, expect } from "vitest";
import { extractJson, validateAnalysis } from "@/lib/ai/validate";

const good = {
  items: [
    { food_name: "Cooked rice", quantity: 150, unit: "g", calories_kcal: 195, protein_g: 4, carbs_g: 43, fat_g: 0.5, confidence: 0.85, assumptions: ["Cooked white rice, without added oil"] },
  ],
  meal_total: { calories_kcal: 99999, protein_g: 0, carbs_g: 0, fat_g: 0 },
  needs_confirmation: true,
};

describe("validateAnalysis: accepts well-formed output", () => {
  it("passes the spec example and recomputes the total itself", () => {
    const r = validateAnalysis(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.items[0]).toMatchObject({ food_name: "Cooked rice", unit: "g", estimation_source: "ai", confidence: 0.85 });
    // the model's bogus meal_total (99999) is ignored
    expect(r.meal_total.calories_kcal).toBe(195);
  });
  it("accepts clean numeric strings and normalises unit aliases", () => {
    const r = validateAnalysis({ items: [{ ...good.items[0], quantity: "2", unit: "Pcs", calories_kcal: "204", protein_g: 6.6, carbs_g: 41, fat_g: 1 }] });
    expect(r.ok && r.items[0]).toMatchObject({ quantity: 2, unit: "piece", calories_kcal: 204 });
  });
  it("sums multiple items", () => {
    const r = validateAnalysis({ items: [good.items[0], { ...good.items[0], food_name: "Dal", calories_kcal: 150, protein_g: 9, carbs_g: 22, fat_g: 2.5 }] });
    expect(r.ok && r.meal_total.calories_kcal).toBe(345);
  });
});

describe("validateAnalysis: rejects malformed or unreasonable output", () => {
  const bad = (patch: object) => validateAnalysis({ items: [{ ...good.items[0], ...patch }] });
  it.each([
    ["negative calories", { calories_kcal: -10 }],
    ["negative protein", { protein_g: -1 }],
    ["zero quantity", { quantity: 0 }],
    ["NaN-ish string", { calories_kcal: "lots" }],
    ["missing food name", { food_name: "  " }],
    ["calories above 3000 for one item", { calories_kcal: 5000 }],
    ["confidence above 1", { confidence: 1.5 }],
    ["absurd weight", { quantity: 4000, unit: "g", calories_kcal: 200 }],
    ["absurd piece count", { quantity: 100, unit: "piece" }],
    ["more kcal per gram than pure fat", { quantity: 10, unit: "g", calories_kcal: 500 }],
    ["unknown unit with no gram estimate", { unit: "serving" }],
  ])("rejects %s", (_n, patch) => {
    expect(bad(patch).ok).toBe(false);
  });
  it("rejects an empty or missing item list and non-objects", () => {
    expect(validateAnalysis({ items: [] }).ok).toBe(false);
    expect(validateAnalysis({}).ok).toBe(false);
    expect(validateAnalysis(null).ok).toBe(false);
    expect(validateAnalysis("hello").ok).toBe(false);
  });
  it("rejects absurdly large total meals", () => {
    const items = Array.from({ length: 4 }, () => ({ ...good.items[0], quantity: 1, unit: "plate", calories_kcal: 2000, protein_g: 100, carbs_g: 200, fat_g: 100 }));
    expect(validateAnalysis({ items }).ok).toBe(false);
  });
});

describe("validateAnalysis: uncertainty is surfaced, not hidden", () => {
  it("uses the gram estimate when the unit is unknown, and records the assumption", () => {
    const r = validateAnalysis({ items: [{ ...good.items[0], quantity: 1, unit: "serving", grams: 150 }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items[0].unit).toBe("g");
      expect(r.items[0].quantity).toBe(150);
      expect(r.items[0].assumptions.join(" ")).toMatch(/estimated 150 g/);
    }
  });
  it("flags calories that don't match macros and lowers confidence", () => {
    const r = validateAnalysis({ items: [{ ...good.items[0], calories_kcal: 600, protein_g: 4, carbs_g: 43, fat_g: 0.5, quantity: 300 }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items[0].warnings.join(" ")).toMatch(/don't quite add up/);
      expect(r.items[0].confidence).toBeLessThanOrEqual(0.4);
    }
  });
  it("warns when the model itself is unsure", () => {
    const r = validateAnalysis({ items: [{ ...good.items[0], confidence: 0.3 }] });
    expect(r.ok && r.items[0].warnings.join(" ")).toMatch(/uncertain/);
  });
  it("leaves confidence null when the model gave none (never invents one)", () => {
    const { confidence: _c, ...noConf } = good.items[0];
    void _c;
    const r = validateAnalysis({ items: [noConf] });
    expect(r.ok && r.items[0].confidence).toBeNull();
  });
});

describe("extractJson", () => {
  it("parses plain JSON, fenced JSON and JSON surrounded by chatter", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":{"b":[1,2]}}\n```')).toEqual({ a: { b: [1, 2] } });
    expect(extractJson('Sure! Here you go: {"a":"}"} hope that helps')).toEqual({ a: "}" });
  });
  it("throws when there is no usable JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
    expect(() => extractJson('{"a":')).toThrow();
  });
});
