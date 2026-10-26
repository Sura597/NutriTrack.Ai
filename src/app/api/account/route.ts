import { authed, ok, ApiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { foodImageBucket } from "@/lib/env";

/**
 * Permanently deletes the signed-in user's account: their images in Storage
 * first, then the auth user (foreign keys cascade to every owned table).
 */
export const DELETE = authed(async ({ user, req }) => {
  let confirm: unknown;
  try {
    confirm = (await req.json())?.confirm;
  } catch {
    confirm = undefined;
  }
  if (confirm !== "DELETE") throw new ApiError(400, "confirmation_required", 'Send {"confirm":"DELETE"} to confirm account deletion.');

  const admin = createAdminClient();
  if (!admin) throw new ApiError(503, "not_configured", "Account deletion needs SUPABASE_SERVICE_ROLE_KEY on the server.");

  const bucket = foodImageBucket();
  // Remove every object under "<user_id>/", paging through the folder.
  for (let guard = 0; guard < 50; guard++) {
    const { data: files, error } = await admin.storage.from(bucket).list(user.id, { limit: 100 });
    if (error) throw new ApiError(500, "storage_error", "Couldn't remove your images. Nothing was deleted; please try again.");
    if (!files || files.length === 0) break;
    const { error: rmErr } = await admin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
    if (rmErr) throw new ApiError(500, "storage_error", "Couldn't remove your images. Nothing was deleted; please try again.");
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) throw new ApiError(500, "delete_failed", "Couldn't delete the account. Please try again or contact support.");
  return ok({ deleted: true });
});
