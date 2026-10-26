import { authed, ok, parseJson, ApiError, dbError } from "@/lib/api";
import { targetsPatchSchema } from "@/lib/schemas";
import { loadProfile, loadTargets, suggestedTargets, syncSuggestedTargets } from "@/lib/data/profile";

export const GET = authed(async ({ supabase, user }) => {
  const profile = await loadProfile(supabase, user.id);
  if (!profile) throw new ApiError(404, "not_found", "Profile not found.");
  const suggested = suggestedTargets(profile);
  const saved = (await loadTargets(supabase, user.id)) ?? (profile.height_cm !== null ? await syncSuggestedTargets(supabase, profile) : null);
  return ok({ targets: saved, suggested, notices: suggested.notices, status: suggested.status });
});

export const PATCH = authed(async ({ supabase, user, req }) => {
  const body = await parseJson(req, targetsPatchSchema);
  const profile = await loadProfile(supabase, user.id);
  if (!profile) throw new ApiError(404, "not_found", "Profile not found.");

  if (body.reset_to_suggested) {
    const targets = await syncSuggestedTargets(supabase, profile, true);
    return ok({ targets, suggested: suggestedTargets(profile) });
  }

  const { reset_to_suggested: _ignored, ...values } = body;
  void _ignored;
  if (Object.keys(values).length === 0) throw new ApiError(400, "invalid_request", "Nothing to update.");

  const { error } = await supabase
    .from("nutrition_targets")
    .upsert({ user_id: user.id, ...values, is_custom: true }, { onConflict: "user_id" });
  if (error) dbError(error, "targets update");
  return ok({ targets: await loadTargets(supabase, user.id), suggested: suggestedTargets(profile) });
});
