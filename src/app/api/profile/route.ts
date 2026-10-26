import { authed, ok, parseJson, ApiError, dbError } from "@/lib/api";
import { profilePatchSchema } from "@/lib/schemas";
import { bmiFor, loadProfile, loadSettings, suggestedTargets, syncSuggestedTargets } from "@/lib/data/profile";

export const GET = authed(async ({ supabase, user }) => {
  const [profile, settings] = await Promise.all([loadProfile(supabase, user.id), loadSettings(supabase, user.id)]);
  if (!profile) throw new ApiError(404, "not_found", "Profile not found.");
  return ok({ profile, settings, bmi: bmiFor(profile), suggested_targets: suggestedTargets(profile) });
});

export const PATCH = authed(async ({ supabase, user, req }) => {
  const body = await parseJson(req, profilePatchSchema);
  const { time_zone, terms_accepted, store_food_images, ...fields } = body;
  const update: Record<string, unknown> = { ...fields };
  if (terms_accepted) update.terms_accepted_at = new Date().toISOString();

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    if (error) dbError(error, "profile update");
  }
  if (time_zone) {
    const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, time_zone }, { onConflict: "user_id" });
    if (error) dbError(error, "settings update");
  }

  if (store_food_images !== undefined) {
    const current = await loadSettings(supabase, user.id);
    const { error } = await supabase
      .from("user_settings")
      .update({ privacy_preferences: { ...current.privacy_preferences, store_food_images } })
      .eq("user_id", user.id);
    if (error) dbError(error, "privacy update");
  }

  const profile = await loadProfile(supabase, user.id);
  if (!profile) throw new ApiError(404, "not_found", "Profile not found.");

  if (fields.onboarding_completed) {
    const missing = (
      [
        ["display_name", profile.display_name],
        ["date_of_birth", profile.date_of_birth],
        ["height_cm", profile.height_cm],
        ["current_weight_kg", profile.current_weight_kg],
      ] as const
    )
      .filter(([, v]) => v === null || v === "")
      .map(([k]) => k);
    if (missing.length) throw new ApiError(400, "incomplete_profile", "Please complete the required profile fields.", { missing });
  }

  // Keep suggested targets in sync (custom targets are never overwritten).
  const targets = profile.height_cm !== null ? await syncSuggestedTargets(supabase, profile) : null;
  const settings = await loadSettings(supabase, user.id);
  return ok({ profile, settings, bmi: bmiFor(profile), targets, suggested_targets: suggestedTargets(profile) });
});
