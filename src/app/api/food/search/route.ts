import { z } from "zod";
import { authed, ok, parseQuery } from "@/lib/api";
import { searchFoods } from "@/lib/food-search";

const query = z.object({ q: z.string().trim().min(1).max(80), limit: z.coerce.number().int().min(1).max(20).default(10) });

export const GET = authed(async ({ supabase, req }) => {
  const { q, limit } = parseQuery(req, query);
  return ok({ foods: await searchFoods(supabase, q, limit) });
});
