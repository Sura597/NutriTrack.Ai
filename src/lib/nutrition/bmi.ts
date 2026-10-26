export type BmiCategory =
  | "underweight"
  | "healthy"
  | "overweight"
  | "obesity"
  | "not_applicable";

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
  /** Short plain-language interpretation suited to the user's age group. */
  interpretation: string;
  /** Always shown next to the BMI so it isn't read as a verdict. */
  limitations: string;
}

export const BMI_LIMITATIONS =
  "BMI is a rough screening number. It doesn't measure body fat, muscle, bone density, " +
  "age, or where weight is carried, so it can misjudge athletic or older people. " +
  "Risk for some conditions begins at lower BMI values in South Asian populations. " +
  "Treat it as one data point, not a diagnosis.";

export function calculateBmi(weightKg: number, heightCm: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) {
    throw new RangeError("Weight and height must be positive numbers");
  }
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** Whole years between a YYYY-MM-DD date of birth and `now`. */
export function ageFromDob(dob: string | Date, now: Date = new Date()): number {
  const d = typeof dob === "string" ? new Date(`${dob}T00:00:00Z`) : dob;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < d.getUTCMonth() ||
    (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function interpretBmi(weightKg: number, heightCm: number, age: number | null): BmiResult {
  const bmi = calculateBmi(weightKg, heightCm);

  if (age === null) {
    return {
      bmi,
      category: "not_applicable",
      interpretation: "Add your date of birth to see an interpretation suited to your age.",
      limitations: BMI_LIMITATIONS,
    };
  }

  if (age < 18) {
    // Adult cut-offs are not valid for children and adolescents; they need
    // age- and sex-specific growth charts.
    return {
      bmi,
      category: "not_applicable",
      interpretation:
        "For people under 18, BMI must be read against age- and sex-specific growth charts. " +
        "Adult categories don't apply. A doctor or school health check can interpret this for you.",
      limitations: BMI_LIMITATIONS,
    };
  }

  let category: BmiCategory;
  let interpretation: string;
  if (bmi < 18.5) {
    category = "underweight";
    interpretation = "Below the standard adult range (18.5 to 24.9).";
  } else if (bmi < 25) {
    category = "healthy";
    interpretation = "Within the standard adult range (18.5 to 24.9).";
  } else if (bmi < 30) {
    category = "overweight";
    interpretation = "Above the standard adult range (25 to 29.9).";
  } else {
    category = "obesity";
    interpretation = "In the 30+ range of the standard adult scale.";
  }

  return { bmi, category, interpretation, limitations: BMI_LIMITATIONS };
}
