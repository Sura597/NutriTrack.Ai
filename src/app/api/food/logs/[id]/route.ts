import { z } from "zod";
import { authed, ok, parseJson, ApiError, dbError } from "@/lib/api";
import { patchLogSchema } from "@/lib/schemas";
import { fetchLog, updateLog } from "@/lib/data/logs";
import { userTimeZone } from "@/lib/data/profile";
import { foodImageBucket } from "@/lib/env";

const idSchema = z.string().uuid();

function logId(params: Record<string, string>) {
  const parsed = idSchema.safeParse(params.id);
  // A malformed id can't match anything: treat as not found rather than leaking details.
  if (!parsed.success) throw new ApiError(404, "not_found", "That meal wasn't found.");
  return parsed.data;
}

export const GET = authed(async ({ supabase, params }) => {
  const id = logId(params);
  const log = await fetchLog(supabase, id); // RLS: other users' rows are simply invisible
  if (!log) throw new ApiError(404, "not_found", "That meal wasn't found.");
  let image_url: string | null = null;
  if (log.image_path) {
    const { data } = await supabase.storage.from(foodImageBucket()).createSignedUrl(log.image_path, 300);
    image_url = data?.signedUrl ?? null;
  }
  return ok({ log, image_url });
});

export const PATCH = authed(async ({ supabase, user, req, params }) => {
  const id = logId(params);
  const patch = await parseJson(req, patchLogSchema);
  const existing = await fetchLog(supabase, id);
  if (!existing) throw new ApiError(404, "not_found", "That meal wasn't found.");
  const tz = await userTimeZone(supabase, user.id);
  await updateLog(supabase, tz, id, patch, existing.meal_type);
  return ok({ log: await fetchLog(supabase, id) });
});

export const DELETE = authed(async ({ supabase, params }) => {
  const id = logId(params);
  const { data, error } = await supabase.from("food_logs").delete().eq("id", id).select("id, image_path");
  if (error) dbError(error, "delete log");
  if (!data || data.length === 0) throw new ApiError(404, "not_found", "That meal wasn't found.");
  const path = data[0].image_path as string | null;
  if (path) {
    // Best effort: storage policies only allow removing the caller's own files.
    const { error: rmErr } = await supabase.storage.from(foodImageBucket()).remove([path]);
    if (rmErr) console.error("[storage] image cleanup failed");
  }
  return ok({ deleted: true });
});
