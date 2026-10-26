import { z } from "zod";
import { authed, ok, parseQuery } from "@/lib/api";
import { isDateString, todayIn } from "@/lib/dates";
import { daySummary } from "@/lib/data/logs";
import { userTimeZone } from "@/lib/data/profile";

const query = z.object({ date: z.string().refine(isDateString, "Use YYYY-MM-DD").optional() });

export const GET = authed(async ({ supabase, user, req }) => {
  const { date } = parseQuery(req, query);
  const tz = await userTimeZone(supabase, user.id);
  const { summary } = await daySummary(supabase, user.id, tz, date ?? todayIn(tz));
  return ok({ summary, time_zone: tz });
});
