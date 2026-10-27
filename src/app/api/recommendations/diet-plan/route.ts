import { z } from "zod";
import { authed, ok, parseQuery } from "@/lib/api";
import { PLAN_DISCLAIMER, buildPlanForUser } from "@/lib/diet-plan/build";

const query = z.object({ variant: z.coerce.number().int().min(0).max(1000).default(0) });

export const GET = authed(async ({ supabase, user, req }) => {
  const { variant } = parseQuery(req, query);
  const { plan, withheld } = await buildPlanForUser(supabase, user.id, variant);
  const message =
    withheld === "no_target"
      ? "We haven't set a daily calorie target for you, so we can't build a plan. This happens when your profile has health notes that call for professional advice, or when details are missing."
      : withheld === "no_profile"
        ? "Finish onboarding to see a plan."
        : null;
  return ok({ plan, withheld, message, variant, disclaimer: PLAN_DISCLAIMER });
});
