import { z } from "zod";
import { authed, ok, parseQuery } from "@/lib/api";
import { isDateString, todayIn } from "@/lib/dates";
import { loadProfile, userTimeZone } from "@/lib/data/profile";
import { waterForDay } from "@/lib/water/summary";

const query = z.object({ date: z.string().refine(isDateString, "Use YYYY-MM-DD").optional() });

export const GET = authed(async ({ supabase, user, req }) => {
  const { date } = parseQuery(req, query);
  const tz = await userTimeZone(supabase, user.id);
  const profile = await loadProfile(supabase, user.id);
  const day = date ?? todayIn(tz);
  const { entries, total_ml } = await waterForDay(supabase, tz, day);
  return ok({ date: day, entries, total_ml, goal_ml: profile?.water_goal_ml ?? 2500, time_zone: tz });
});
