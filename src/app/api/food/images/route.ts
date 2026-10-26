import { z } from "zod";
import { authed, ok, parseJson, ApiError } from "@/lib/api";
import { foodImageBucket } from "@/lib/env";

const body = z.object({ path: z.string().min(3).max(300) });

/** Discards an uploaded photo the user decided not to save with a meal. Only the caller's own folder is allowed. */
export const DELETE = authed(async ({ supabase, user, req }) => {
  const { path } = await parseJson(req, body);
  if (!path.startsWith(`${user.id}/`) || path.includes("..")) throw new ApiError(400, "invalid_path", "That image doesn't belong to your account.");
  // A photo already attached to a saved meal must not be removed this way.
  const { data: used } = await supabase.from("food_logs").select("id").eq("image_path", path).limit(1);
  if (used && used.length > 0) throw new ApiError(409, "image_in_use", "That photo is attached to a saved meal. Delete the meal instead.");
  const { error } = await supabase.storage.from(foodImageBucket()).remove([path]);
  if (error) throw new ApiError(500, "storage_error", "Couldn't remove that photo.");
  return ok({ deleted: true });
});
