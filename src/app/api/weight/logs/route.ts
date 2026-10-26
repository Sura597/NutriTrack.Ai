import { ApiError, authed, ok, parseJson, dbError } from "@/lib/api";
import { weightLogSchema } from "@/lib/schemas";

export const POST = authed(async ({ supabase, user, req }) => {
  const body = await parseJson(req, weightLogSchema);
  const measuredAt = body.measured_at ? new Date(body.measured_at) : new Date();
  // Allow a little clock skew but not future-dated entries.
  if (measuredAt.getTime() > Date.now() + 5 * 60_000) {
    throw new ApiError(400, "invalid_request", "Weight can't be logged for a future time.");
  }
  const { data, error } = await supabase
    .from("user_weight_logs")
    .insert({ user_id: user.id, weight_kg: body.weight_kg, measured_at: measuredAt.toISOString(), notes: body.notes ?? null })
    .select("id, measured_at, weight_kg, notes")
    .single();
  if (error) dbError(error, "weight insert");

  // Keep the profile's current weight in step with the newest measurement.
  const { data: latest } = await supabase
    .from("user_weight_logs")
    .select("id")
    .eq("user_id", user.id)
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest?.id === data.id) {
    await supabase.from("profiles").update({ current_weight_kg: body.weight_kg }).eq("id", user.id);
  }
  return ok({ log: { ...data, weight_kg: Number(data.weight_kg) } }, 201);
});
