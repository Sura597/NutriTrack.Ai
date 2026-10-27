import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTargets, type NutritionTargets } from "@/lib/nutrition/targets";
import { ageFromDob, interpretBmi, type BmiResult } from "@/lib/nutrition/bmi";
import { DEFAULT_TIME_ZONE } from "@/lib/dates";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  date_of_birth: string | null;
  sex: "male" | "female" | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: "sedentary" | "light" | "moderate" | "very_active";
  goal: "lose" | "maintain" | "gain";
  dietary_preference: "vegetarian" | "vegan" | "eggetarian" | "non_vegetarian";
  allergies: string[];
  dietary_restrictions: string[];
  daily_budget_inr: number | null;
  food_preferences: string | null;
  cooking_facilities: string[];
  pregnant_or_breastfeeding: boolean;
  has_medical_condition: boolean;
  eating_disorder_history: boolean;
  region: string;
  price_adjustment_pct: number;
  water_goal_ml: number;
  onboarding_completed: boolean;
  terms_accepted_at: string | null;
}

export interface SettingsRow {
  user_id: string;
  preferred_units: string;
  time_zone: string;
  notification_preferences: Record<string, unknown>;
  privacy_preferences: Record<string, unknown>;
}

export interface TargetsRow {
  user_id: string;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  micronutrients: Record<string, number>;
  is_custom: boolean;
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function normalizeProfile(r: Record<string, unknown>): ProfileRow {
  return {
    ...(r as unknown as ProfileRow),
    height_cm: num(r.height_cm),
    current_weight_kg: num(r.current_weight_kg),
    target_weight_kg: num(r.target_weight_kg),
    daily_budget_inr: num(r.daily_budget_inr),
    price_adjustment_pct: num(r.price_adjustment_pct) ?? 0,
    water_goal_ml: num(r.water_goal_ml) ?? 2500,
  };
}

export async function loadProfile(supabase: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data ? normalizeProfile(data) : null;
}

export async function loadSettings(supabase: SupabaseClient, userId: string): Promise<SettingsRow> {
  const { data, error } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data as SettingsRow;
  // Self-heal if the signup trigger didn't create the row.
  const { data: created, error: insErr } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return created as SettingsRow;
}

export async function userTimeZone(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase.from("user_settings").select("time_zone").eq("user_id", userId).maybeSingle();
  return data?.time_zone || DEFAULT_TIME_ZONE;
}

export function suggestedTargets(profile: ProfileRow): NutritionTargets {
  if (profile.height_cm === null || profile.current_weight_kg === null) {
    return computeTargets({
      sex: profile.sex,
      dateOfBirth: null,
      heightCm: 170,
      weightKg: 65,
      activityLevel: profile.activity_level,
      goal: profile.goal,
    });
  }
  return computeTargets({
    sex: profile.sex,
    dateOfBirth: profile.date_of_birth,
    heightCm: profile.height_cm,
    weightKg: profile.current_weight_kg,
    activityLevel: profile.activity_level,
    goal: profile.goal,
    pregnantOrBreastfeeding: profile.pregnant_or_breastfeeding,
    hasMedicalCondition: profile.has_medical_condition,
    eatingDisorderHistory: profile.eating_disorder_history,
  });
}

export function bmiFor(profile: ProfileRow): BmiResult | null {
  if (profile.height_cm === null || profile.current_weight_kg === null) return null;
  const age = profile.date_of_birth ? ageFromDob(profile.date_of_birth) : null;
  return interpretBmi(profile.current_weight_kg, profile.height_cm, age);
}

export async function loadTargets(supabase: SupabaseClient, userId: string): Promise<TargetsRow | null> {
  const { data, error } = await supabase.from("nutrition_targets").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data as TargetsRow),
    calories_kcal: num(data.calories_kcal),
    protein_g: num(data.protein_g),
    carbs_g: num(data.carbs_g),
    fat_g: num(data.fat_g),
    fiber_g: num(data.fiber_g),
  };
}

/**
 * Recomputes the suggested targets from the profile and saves them, unless the
 * user has set custom targets (which we never overwrite silently).
 */
export async function syncSuggestedTargets(supabase: SupabaseClient, profile: ProfileRow, force = false) {
  const existing = await loadTargets(supabase, profile.id);
  if (existing?.is_custom && !force) return existing;
  const t = suggestedTargets(profile);
  const row = {
    user_id: profile.id,
    calories_kcal: t.calories_kcal,
    protein_g: t.protein_g,
    carbs_g: t.carbs_g,
    fat_g: t.fat_g,
    fiber_g: t.fiber_g,
    micronutrients: t.micronutrients ?? {},
    is_custom: false,
  };
  const { error } = await supabase.from("nutrition_targets").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
  return (await loadTargets(supabase, profile.id))!;
}
