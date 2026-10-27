import { z } from "zod";
import { authed, ok, ApiError, dbError } from "@/lib/api";

const idSchema = z.string().uuid();

export const DELETE = authed(async ({ supabase, user, params }) => {
  const parsed = idSchema.safeParse(params.id);
  if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid water entry id.");
  const { data, error } = await supabase.from("water_logs").delete().eq("id", parsed.data).eq("user_id", user.id).select("id");
  if (error) dbError(error, "water delete");
  if (!data?.length) throw new ApiError(404, "not_found", "Water entry not found.");
  return ok({ deleted: true });
});
