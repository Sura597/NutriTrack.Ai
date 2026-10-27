import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProfile, loadTargets } from "@/lib/data/profile";
import { generateDayPlan } from "@/lib/diet-plan/engine";
import { loadPlanFoods } from "@/lib/diet-plan/load";

export const PLAN_DISCLAIMER =
  "A general example day built from common Indian foods and your calorie target. It is not medical or clinical dietary advice. If you have a medical condition, are pregnant or breastfeeding, or have a history of disordered eating, please work with a doctor or registered dietitian.";

/** Returns a plan, or a reason it is withheld (no calorie target is set for the user). */
export async function buildPlanForUser(supabase: SupabaseClient, userId: string, variant: number) {
  const [profile, targets] = await Promise.all([loadProfile(supabase, userId), loadTargets(supabase, userId)]);
  if (!profile) return { plan: null, withheld: "no_profile" as const };
  if (!targets?.calories_kcal) return { plan: null, withheld: "no_target" as const };
  const foods = await loadPlanFoods(supabase, profile.region, profile.price_adjustment_pct);
  const plan = generateDayPlan({
    foods,
    diet: profile.dietary_preference,
    allergies: profile.allergies,
    targetKcal: targets.calories_kcal,
    targetProteinG: targets.protein_g,
    dailyBudgetInr: profile.daily_budget_inr,
    variant,
  });
  return { plan, withheld: null };
}
