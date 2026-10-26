import { z } from "zod";
import { authed, ok, ApiError, dbError } from "@/lib/api";

const idSchema = z.string().uuid();

export const DELETE = authed(async ({ supabase, user, params }) => {
  const parsed = idSchema.safeParse(params.id);
  if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid weight log id.");
  const { data, error } = await supabase
    .from("user_weight_logs")
    .delete()
    .eq("id", parsed.data)
    .eq("user_id", user.id)
    .select("id");
  if (error) dbError(error, "weight delete");
  if (!data?.length) throw new ApiError(404, "not_found", "Weight entry not found.");
  return ok({ deleted: true });
});
