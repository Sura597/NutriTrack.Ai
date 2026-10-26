import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data/session";
import { loadProfile } from "@/lib/data/profile";
import { ProfileForm } from "@/components/profile/profile-form";
import { Logo } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const profile = await loadProfile(supabase, user.id);
  if (profile?.onboarding_completed) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <Logo />
      <div>
        <h1 className="text-2xl font-semibold">Let&apos;s personalise your plan</h1>
        <p className="mt-1 text-muted-foreground">A few quick questions. We only ask for what we need to estimate your daily targets.</p>
      </div>
      <ProfileForm mode="onboarding" profile={profile} />
    </main>
  );
}
