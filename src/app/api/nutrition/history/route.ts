import { z } from "zod";
import { authed, ok, parseQuery } from "@/lib/api";
import { isDateString } from "@/lib/dates";
import { userTimeZone } from "@/lib/data/profile";
import { loadInsights } from "@/lib/insights/load";

const query = z.object({
  range: z.enum(["day", "week", "month"]).default("week"),
  end: z.string().refine(isDateString, "Use YYYY-MM-DD").optional(),
});

export const GET = authed(async ({ supabase, user, req }) => {
  const { range, end } = parseQuery(req, query);
  const tz = await userTimeZone(supabase, user.id);
  return ok({ ...(await loadInsights(supabase, user.id, tz, range, end)), time_zone: tz });
});
