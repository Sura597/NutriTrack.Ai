import { ApiError, authed, ok, parseJson, dbError } from "@/lib/api";
import { waterLogSchema } from "@/lib/schemas";

export const POST = authed(async ({ supabase, user, req }) => {
  const body = await parseJson(req, waterLogSchema);
  const at = body.consumed_at ? new Date(body.consumed_at) : new Date();
  if (at.getTime() > Date.now() + 5 * 60_000) throw new ApiError(400, "invalid_request", "Water can't be logged for a future time.");
  const { data, error } = await supabase
    .from("water_logs")
    .insert({ user_id: user.id, amount_ml: body.amount_ml, consumed_at: at.toISOString() })
    .select("id, consumed_at, amount_ml")
    .single();
  if (error) dbError(error, "water insert");
  return ok({ log: data }, 201);
});
