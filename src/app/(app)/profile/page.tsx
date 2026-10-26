import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/data/session";
import { bmiFor, loadTargets, suggestedTargets } from "@/lib/data/profile";
import { ProfileForm } from "@/components/profile/profile-form";
import { TargetsEditor } from "@/components/profile/targets-editor";
import { AccountSection } from "@/components/profile/account-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Profile & settings" };

export default async function ProfilePage() {
  const { supabase, user, profile, settings } = await requireOnboardedUser();
  const [targets] = await Promise.all([loadTargets(supabase, user.id)]);
  const suggested = suggestedTargets(profile);
  const bmi = bmiFor(profile);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Profile &amp; settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Body measures</CardTitle>
          <CardDescription>Measured values you entered. These are separate from your food logs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Current weight</dt><dd className="text-lg font-semibold">{profile.current_weight_kg} kg</dd></div>
            <div><dt className="text-xs text-muted-foreground">Target weight</dt><dd className="text-lg font-semibold">{profile.target_weight_kg ? `${profile.target_weight_kg} kg` : "Not set"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Height</dt><dd className="text-lg font-semibold">{profile.height_cm} cm</dd></div>
            <div><dt className="text-xs text-muted-foreground">BMI</dt><dd className="text-lg font-semibold">{bmi ? bmi.bmi : "n/a"}</dd></div>
          </dl>
          {bmi && <p className="text-sm">{bmi.interpretation}</p>}
          {bmi && <p className="text-xs text-muted-foreground">{bmi.limitations}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily targets</CardTitle>
          <CardDescription>Starting estimates from the Mifflin-St Jeor equation. Individual needs vary, so adjust them if a doctor or dietitian advised something different.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {suggested.status === "restricted" && (
            <Notice tone="warn" title="We aren't suggesting targets for you">
              {suggested.notices.map((n) => <p key={n} className="mt-1">{n}</p>)}
            </Notice>
          )}
          <TargetsEditor targets={targets} suggested={suggested} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Your details</h2>
        <ProfileForm mode="edit" profile={profile} timeZoneInitial={settings.time_zone} />
      </div>

      <AccountSection />
    </div>
  );
}
