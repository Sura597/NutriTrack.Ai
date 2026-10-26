import { z } from "zod";
import { authed, ok, parseQuery, dbError } from "@/lib/api";

const query = z.object({ days: z.coerce.number().int().min(7).max(730).default(90) });

export const GET = authed(async ({ supabase, user, req }) => {
  const { days } = parseQuery(req, query);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("user_weight_logs")
    .select("id, measured_at, weight_kg, notes")
    .eq("user_id", user.id)
    .gte("measured_at", since)
    .order("measured_at", { ascending: true })
    .limit(1000);
  if (error) dbError(error, "weight history");
  const logs = (data ?? []).map((r) => ({ ...r, weight_kg: Number(r.weight_kg) }));
  const first = logs[0]?.weight_kg ?? null;
  const last = logs.at(-1)?.weight_kg ?? null;
  return ok({
    logs,
    change_kg: first !== null && last !== null ? Math.round((last - first) * 10) / 10 : null,
  });
});
