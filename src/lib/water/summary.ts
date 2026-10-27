import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "@/lib/api";
import { dayRange } from "@/lib/dates";

export interface WaterEntry {
  id: string;
  consumed_at: string;
  amount_ml: number;
}

export async function waterForDay(supabase: SupabaseClient, tz: string, date: string) {
  const { start, end } = dayRange(date, tz);
  const { data, error } = await supabase
    .from("water_logs")
    .select("id, consumed_at, amount_ml")
    .gte("consumed_at", start.toISOString())
    .lt("consumed_at", end.toISOString())
    .order("consumed_at", { ascending: false })
    .limit(200);
  if (error) dbError(error, "water day");
  const entries: WaterEntry[] = (data ?? []).map((r) => ({ id: r.id, consumed_at: r.consumed_at, amount_ml: Number(r.amount_ml) }));
  return { entries, total_ml: entries.reduce((a, e) => a + e.amount_ml, 0) };
}
