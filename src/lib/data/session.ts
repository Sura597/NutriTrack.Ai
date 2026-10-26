import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProfile, loadSettings } from "@/lib/data/profile";

/** Verified current user for server components. Redirects to sign-in when signed out. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/sign-in");
  return { supabase, user: data.user };
});

/** Signed-in user with a completed profile; otherwise sends them to onboarding. */
export const requireOnboardedUser = cache(async () => {
  const { supabase, user } = await requireUser();
  const [profile, settings] = await Promise.all([loadProfile(supabase, user.id), loadSettings(supabase, user.id)]);
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");
  return { supabase, user, profile, settings };
});
