import { describe, it, expect } from "vitest";
import { ageFromDob, calculateBmi, interpretBmi } from "@/lib/nutrition/bmi";

describe("calculateBmi", () => {
  it("computes weight / height^2 rounded to 1 decimal", () => {
    expect(calculateBmi(70, 175)).toBe(22.9);
    expect(calculateBmi(50, 160)).toBe(19.5);
    expect(calculateBmi(100, 170)).toBe(34.6);
  });
  it("rejects non-positive or non-finite inputs", () => {
    expect(() => calculateBmi(0, 170)).toThrow(RangeError);
    expect(() => calculateBmi(70, -1)).toThrow(RangeError);
    expect(() => calculateBmi(NaN, 170)).toThrow(RangeError);
  });
});

describe("ageFromDob", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  it("counts whole years and respects birthdays not yet reached", () => {
    expect(ageFromDob("2000-06-15", now)).toBe(26);
    expect(ageFromDob("2000-06-16", now)).toBe(25);
    expect(ageFromDob("2008-01-01", now)).toBe(18);
  });
});

describe("interpretBmi", () => {
  it("uses standard adult categories", () => {
    expect(interpretBmi(50, 175, 30).category).toBe("underweight"); // 16.3
    expect(interpretBmi(70, 175, 30).category).toBe("healthy"); // 22.9
    expect(interpretBmi(85, 175, 30).category).toBe("overweight"); // 27.8
    expect(interpretBmi(100, 170, 30).category).toBe("obesity"); // 34.6
  });
  it("handles exact boundaries", () => {
    expect(interpretBmi(18.5, 100, 30).category).toBe("healthy"); // 18.5
    expect(interpretBmi(25, 100, 30).category).toBe("overweight"); // 25.0
    expect(interpretBmi(30, 100, 30).category).toBe("obesity"); // 30.0
  });
  it("never applies adult categories to under-18s", () => {
    const r = interpretBmi(40, 160, 15);
    expect(r.category).toBe("not_applicable");
    expect(r.interpretation).toMatch(/under 18/i);
  });
  it("does not interpret without an age", () => {
    expect(interpretBmi(70, 175, null).category).toBe("not_applicable");
  });
  it("always includes the limitations note", () => {
    expect(interpretBmi(70, 175, 30).limitations).toMatch(/not a diagnosis/i);
  });
});
