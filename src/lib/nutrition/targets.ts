import { ageFromDob } from "./bmi";

export type Sex = "male" | "female" | null;
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active";
export type Goal = "lose" | "maintain" | "gain";

export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
};

export interface TargetInput {
  sex: Sex;
  dateOfBirth: string | null;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Flags that mean we should not hand out a prescriptive calorie target. */
  pregnantOrBreastfeeding?: boolean;
  hasMedicalCondition?: boolean;
  eatingDisorderHistory?: boolean;
  now?: Date;
}

export interface MicronutrientTargets {
  iron_mg: number;
  calcium_mg: number;
  vitamin_c_mg: number;
  vitamin_d_iu: number;
  vitamin_b12_mcg: number;
}

export interface NutritionTargets {
  /** "restricted" means no prescriptive numbers: user should see a professional. */
  status: "ok" | "restricted";
  notices: string[];
  bmr: number | null;
  maintenance_kcal: number | null;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  micronutrients: MicronutrientTargets | null;
}

// Safety rails: no aggressive deficits or surpluses.
export const MAX_DEFICIT_FRACTION = 0.15; // lose: at most 15% below maintenance
export const MAX_DEFICIT_KCAL = 500;
export const SURPLUS_FRACTION = 0.1; // gain: ~10% above maintenance
export const MAX_SURPLUS_KCAL = 400;
export const MIN_CALORIES = 1200;

/**
 * Mifflin-St Jeor resting energy estimate (kcal/day).
 * When sex is unknown we use the midpoint of the male (+5) and female (-161)
 * constants (-78) rather than guessing.
 */
export function mifflinStJeor(opts: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const { sex, weightKg, heightCm, age } = opts;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const constant = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return Math.round(base + constant);
}

function restricted(notices: string[]): NutritionTargets {
  return {
    status: "restricted",
    notices,
    bmr: null,
    maintenance_kcal: null,
    calories_kcal: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    fiber_g: null,
    micronutrients: null,
  };
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function micronutrientReference(sex: Sex, age: number): MicronutrientTargets | null {
  // Adult reference values only (approximate, based on ICMR-NIN 2020 RDAs).
  // Needs differ for children, pregnancy, older adults and medical conditions.
  if (age < 19) return null;
  return {
    // Iron differs a lot by sex; when sex is unknown we show the higher value
    // so the user isn't told they are fine when they may not be.
    iron_mg: sex === "male" ? 19 : 29,
    calcium_mg: 1000,
    vitamin_c_mg: sex === "male" ? 80 : 65,
    vitamin_d_iu: 600,
    vitamin_b12_mcg: 2.2,
  };
}

export function computeTargets(input: TargetInput): NutritionTargets {
  const now = input.now ?? new Date();
  const age = input.dateOfBirth ? ageFromDob(input.dateOfBirth, now) : null;

  if (
    input.pregnantOrBreastfeeding ||
    input.hasMedicalCondition ||
    input.eatingDisorderHistory
  ) {
    return restricted([
      "Because of what you told us (pregnancy or breastfeeding, a medical condition, or a history of disordered eating), " +
        "we don't suggest calorie or nutrient targets. Please speak with a doctor or registered dietitian for a plan made for you.",
      "You can still log meals to see what you eat, and set your own targets in settings if a professional gave you numbers.",
    ]);
  }

  if (age === null) {
    return restricted([
      "Add your date of birth so we can estimate your needs safely. We can't suggest targets without your age.",
    ]);
  }

  const notices: string[] = [
    "These are starting estimates from a standard equation. Individual needs vary, so adjust them to what works for you.",
  ];

  const bmr = mifflinStJeor({
    sex: input.sex,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    age,
  });
  const maintenance = Math.round(bmr * ACTIVITY_MULTIPLIER[input.activityLevel]);

  let goal: Goal = input.goal;
  if (age < 18) {
    // No weight-loss (or gain) targets for minors.
    if (goal !== "maintain") {
      notices.push(
        "For people under 18 we only show a maintenance estimate. Growing bodies need individual advice from a doctor.",
      );
    }
    goal = "maintain";
  }

  let calories = maintenance;
  if (goal === "lose") {
    const deficit = Math.min(maintenance * MAX_DEFICIT_FRACTION, MAX_DEFICIT_KCAL);
    calories = Math.max(maintenance - deficit, MIN_CALORIES);
    // The floor must never push the target above maintenance.
    calories = Math.min(calories, maintenance);
  } else if (goal === "gain") {
    calories = maintenance + Math.min(maintenance * SURPLUS_FRACTION, MAX_SURPLUS_KCAL);
  }
  calories = roundTo(calories, 10);

  if (input.sex === null) {
    notices.push("You skipped sex, so we used a neutral midpoint in the equation. Your real needs may be somewhat higher or lower.");
  }

  // Protein: grams per kg body weight, by goal (modest, within common guidance).
  const proteinPerKg = goal === "lose" ? 1.2 : goal === "gain" ? 1.4 : 1.0;
  let protein = proteinPerKg * input.weightKg;
  // Never let protein exceed 30% of calories.
  protein = Math.min(protein, (calories * 0.3) / 4);
  protein = Math.round(protein);

  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fiber = Math.max(25, Math.round((calories / 1000) * 14));

  const micronutrients = micronutrientReference(input.sex, age);
  if (!micronutrients) {
    notices.push("Vitamin and mineral reference values are only shown for adults.");
  }

  return {
    status: "ok",
    notices,
    bmr,
    maintenance_kcal: maintenance,
    calories_kcal: calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fiber_g: fiber,
    micronutrients,
  };
}
