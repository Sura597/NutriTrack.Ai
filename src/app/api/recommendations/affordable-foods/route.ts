import { z } from "zod";
import { authed, ok, parseQuery, ApiError } from "@/lib/api";
import { todayIn } from "@/lib/dates";
import { fetchLogsForDay } from "@/lib/data/logs";
import { loadProfile, loadTargets, userTimeZone } from "@/lib/data/profile";
import { sumMacros } from "@/lib/nutrition/aggregate";
import { RECOMMENDATION_FILTERS, recommend } from "@/lib/recommendations/engine";
import { estimateSpendInr, loadPricedFoods } from "@/lib/recommendations/load";

const query = z.object({
  filters: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(RECOMMENDATION_FILTERS)).max(5)),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const GET = authed(async ({ supabase, user, req }) => {
  const { filters, limit } = parseQuery(req, query);
  const profile = await loadProfile(supabase, user.id);
  if (!profile) throw new ApiError(404, "profile_not_found", "Finish onboarding to see recommendations.");

  const [tz, targets] = await Promise.all([userTimeZone(supabase, user.id), loadTargets(supabase, user.id)]);
  const foods = await loadPricedFoods(supabase, profile.region);
  const logs = await fetchLogsForDay(supabase, tz, todayIn(tz));
  const consumed = sumMacros(logs.flatMap((l) => l.items));
  const adj = profile.price_adjustment_pct;

  const remainingKcal = targets?.calories_kcal != null ? Math.round(targets.calories_kcal - consumed.calories_kcal) : null;
  const spend = estimateSpendInr(logs, foods, adj);
  const remainingBudget = profile.daily_budget_inr != null ? Math.round((profile.daily_budget_inr - spend.spent) * 100) / 100 : null;

  const items = recommend({
    foods,
    diet: profile.dietary_preference,
    allergies: profile.allergies,
    filters,
    remainingKcal,
    remainingBudgetInr: remainingBudget,
    priceAdjustmentPct: adj,
    limit,
  });

  return ok({
    recommendations: items,
    context: {
      remaining_kcal: remainingKcal,
      daily_budget_inr: profile.daily_budget_inr,
      estimated_spend_today_inr: spend.spent,
      remaining_budget_inr: remainingBudget,
      unpriced_items_today: spend.unpricedItems,
      price_adjustment_pct: adj,
      region: profile.region,
    },
    disclaimer: "Prices are rough estimates and vary by city, season and shop. Adjust them in your profile.",
  });
});
