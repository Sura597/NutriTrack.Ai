import { describe, it, expect } from "vitest";
import { computeTargets, mifflinStJeor, MIN_CALORIES } from "@/lib/nutrition/targets";

const now = new Date("2026-06-15T00:00:00Z");
const base = {
  sex: "male" as const,
  dateOfBirth: "1996-06-15", // 30
  heightCm: 175,
  weightKg: 70,
  activityLevel: "sedentary" as const,
  goal: "maintain" as const,
  now,
};

describe("mifflinStJeor", () => {
  it("matches the published equation", () => {
    // 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    expect(mifflinStJeor({ sex: "male", weightKg: 70, heightCm: 175, age: 30 })).toBe(1649);
    // ... - 161 = 1482.75
    expect(mifflinStJeor({ sex: "female", weightKg: 70, heightCm: 175, age: 30 })).toBe(1483);
  });
  it("uses the midpoint constant when sex is unknown", () => {
    const m = mifflinStJeor({ sex: "male", weightKg: 70, heightCm: 175, age: 30 });
    const f = mifflinStJeor({ sex: "female", weightKg: 70, heightCm: 175, age: 30 });
    const u = mifflinStJeor({ sex: null, weightKg: 70, heightCm: 175, age: 30 });
    expect(u).toBeGreaterThan(f);
    expect(u).toBeLessThan(m);
  });
});

describe("computeTargets", () => {
  it("maintenance = BMR x activity multiplier", () => {
    const t = computeTargets(base);
    expect(t.status).toBe("ok");
    expect(t.bmr).toBe(1649);
    expect(t.maintenance_kcal).toBe(Math.round(1649 * 1.2));
    expect(t.calories_kcal).toBe(Math.round((1649 * 1.2) / 10) * 10);
  });

  it("keeps a weight-loss deficit modest (<= 15% and <= 500 kcal)", () => {
    const m = computeTargets({ ...base, activityLevel: "moderate" });
    const l = computeTargets({ ...base, activityLevel: "moderate", goal: "lose" });
    const deficit = m.maintenance_kcal! - l.calories_kcal!;
    expect(deficit).toBeGreaterThan(0);
    expect(deficit).toBeLessThanOrEqual(500 + 5); // rounding to nearest 10
    expect(deficit / m.maintenance_kcal!).toBeLessThanOrEqual(0.15 + 0.01);
  });

  it("keeps a weight-gain surplus modest and above maintenance", () => {
    const m = computeTargets(base);
    const g = computeTargets({ ...base, goal: "gain" });
    expect(g.calories_kcal!).toBeGreaterThan(m.calories_kcal!);
    expect(g.calories_kcal! - m.maintenance_kcal!).toBeLessThanOrEqual(400 + 5);
  });

  it("never drops below the calorie floor and never exceeds maintenance when losing", () => {
    const small = computeTargets({ ...base, sex: "female", weightKg: 40, heightCm: 145, dateOfBirth: "1960-01-01", goal: "lose" });
    expect(small.calories_kcal!).toBeGreaterThanOrEqual(Math.min(MIN_CALORIES, small.maintenance_kcal!));
    expect(small.calories_kcal!).toBeLessThanOrEqual(small.maintenance_kcal! + 5);
  });

  it("macros roughly add up to the calorie target", () => {
    const t = computeTargets({ ...base, activityLevel: "moderate" });
    const kcal = t.protein_g! * 4 + t.carbs_g! * 4 + t.fat_g! * 9;
    expect(Math.abs(kcal - t.calories_kcal!)).toBeLessThan(30);
  });

  it("caps protein at 30% of calories", () => {
    const t = computeTargets({ ...base, weightKg: 140, heightCm: 150, goal: "gain" });
    expect((t.protein_g! * 4) / t.calories_kcal!).toBeLessThanOrEqual(0.31);
  });

  it("gives minors a maintenance estimate only, with a notice", () => {
    const lose = computeTargets({ ...base, dateOfBirth: "2011-06-15", goal: "lose" }); // age 15
    const maintain = computeTargets({ ...base, dateOfBirth: "2011-06-15", goal: "maintain" });
    expect(lose.calories_kcal).toBe(maintain.calories_kcal);
    expect(lose.notices.join(" ")).toMatch(/under 18/i);
    expect(lose.micronutrients).toBeNull();
  });

  it.each([
    ["pregnant or breastfeeding", { pregnantOrBreastfeeding: true }],
    ["medical condition", { hasMedicalCondition: true }],
    ["eating disorder history", { eatingDisorderHistory: true }],
  ])("withholds prescriptive targets for %s", (_label, flag) => {
    const t = computeTargets({ ...base, ...flag });
    expect(t.status).toBe("restricted");
    expect(t.calories_kcal).toBeNull();
    expect(t.protein_g).toBeNull();
    expect(t.notices.join(" ")).toMatch(/doctor or registered dietitian/i);
  });

  it("withholds targets when age is unknown", () => {
    expect(computeTargets({ ...base, dateOfBirth: null }).status).toBe("restricted");
  });

  it("scales with activity level", () => {
    const a = computeTargets({ ...base, activityLevel: "sedentary" }).calories_kcal!;
    const b = computeTargets({ ...base, activityLevel: "very_active" }).calories_kcal!;
    expect(b).toBeGreaterThan(a);
  });

  it("uses a higher iron reference when sex is unknown or female", () => {
    expect(computeTargets(base).micronutrients?.iron_mg).toBe(19);
    expect(computeTargets({ ...base, sex: "female" }).micronutrients?.iron_mg).toBe(29);
    expect(computeTargets({ ...base, sex: null }).micronutrients?.iron_mg).toBe(29);
  });
});
