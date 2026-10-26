import { z } from "zod";
import { isDateString, isValidTimeZone } from "@/lib/dates";
import { ALL_UNITS } from "@/lib/nutrition/units";

export const activityLevel = z.enum(["sedentary", "light", "moderate", "very_active"]);
export const goal = z.enum(["lose", "maintain", "gain"]);
export const dietaryPreference = z.enum(["vegetarian", "vegan", "eggetarian", "non_vegetarian"]);
export const mealType = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const inputMethod = z.enum(["photo", "text", "voice", "manual"]);

export const ALLERGEN_OPTIONS = ["gluten", "dairy", "egg", "peanut", "tree_nut", "soy", "fish", "shellfish"] as const;
export const COOKING_OPTIONS = ["stove", "pressure_cooker", "microwave", "kettle_only", "no_cooking"] as const;

const dateOfBirth = z
  .string()
  .refine(isDateString, "Use the format YYYY-MM-DD")
  .refine((s) => new Date(s) <= new Date(), "Date of birth can't be in the future")
  .refine((s) => new Date(s).getUTCFullYear() >= 1900, "Please check the year");

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Please enter your name").max(80),
  date_of_birth: dateOfBirth,
  sex: z.enum(["male", "female"]).nullable(),
  height_cm: z.number().min(50, "Height looks too low").max(250, "Height looks too high"),
  current_weight_kg: z.number().min(20, "Weight looks too low").max(400, "Weight looks too high"),
  target_weight_kg: z.number().min(20).max(400).nullable(),
  activity_level: activityLevel,
  goal,
  dietary_preference: dietaryPreference,
  allergies: z.array(z.enum(ALLERGEN_OPTIONS)).max(8),
  dietary_restrictions: z.array(z.string().trim().min(1).max(60)).max(10),
  daily_budget_inr: z.number().min(0).max(100000).nullable(),
  food_preferences: z.string().trim().max(500).nullable(),
  cooking_facilities: z.array(z.enum(COOKING_OPTIONS)).max(5),
  pregnant_or_breastfeeding: z.boolean(),
  has_medical_condition: z.boolean(),
  eating_disorder_history: z.boolean(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const profilePatchSchema = profileSchema.partial().extend({
  onboarding_completed: z.boolean().optional(),
  terms_accepted: z.literal(true).optional(),
  time_zone: z.string().refine(isValidTimeZone, "Unknown time zone").optional(),
  store_food_images: z.boolean().optional(),
  price_adjustment_pct: z.number().min(-50).max(200).optional(),
});

export const targetsPatchSchema = z
  .object({
    calories_kcal: z.number().min(800).max(6000),
    protein_g: z.number().min(0).max(400),
    carbs_g: z.number().min(0).max(800),
    fat_g: z.number().min(0).max(300),
    fiber_g: z.number().min(0).max(120),
    reset_to_suggested: z.boolean(),
  })
  .partial();

const nonNegative = (max: number) => z.number().min(0).max(max);

export const logItemSchema = z.object({
  food_name: z.string().trim().min(1).max(200),
  quantity: z.number().gt(0).max(100000),
  unit: z.enum(ALL_UNITS),
  calories_kcal: nonNegative(5000),
  protein_g: nonNegative(500),
  carbs_g: nonNegative(1000),
  fat_g: nonNegative(500),
  fiber_g: nonNegative(200).default(0),
  micronutrients: z.record(z.string(), z.number().min(0).max(100000)).default({}),
  estimation_source: z.enum(["database", "ai", "manual"]),
  food_database_id: z.string().uuid().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  assumptions: z.array(z.string().max(300)).max(10).default([]),
});
export type LogItemInput = z.infer<typeof logItemSchema>;

export const createLogSchema = z.object({
  date: z.string().refine(isDateString, "Use YYYY-MM-DD"),
  meal_type: mealType,
  input_method: inputMethod,
  original_input: z.string().max(2000).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  image_path: z.string().max(300).nullable().optional(),
  items: z.array(logItemSchema).min(1, "Add at least one food item").max(30),
});
export type CreateLogInput = z.infer<typeof createLogSchema>;

export const patchLogSchema = z.object({
  meal_type: mealType.optional(),
  notes: z.string().max(1000).nullable().optional(),
  date: z.string().refine(isDateString, "Use YYYY-MM-DD").optional(),
  items: z.array(logItemSchema).min(1).max(30).optional(),
});

export const listLogsQuery = z.object({
  date: z.string().refine(isDateString).optional(),
  from: z.string().refine(isDateString).optional(),
  to: z.string().refine(isDateString).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
});

export const weightLogSchema = z.object({
  weight_kg: z.number().min(20).max(400),
  measured_at: z.string().datetime().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});
