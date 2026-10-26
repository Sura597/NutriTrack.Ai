import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/auth/auth-shell";
import { APP_NAME } from "@/lib/format";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Logo />
      <article className="prose-sm mt-6 space-y-4 text-[15px] leading-relaxed">
        <h1 className="text-3xl font-semibold">Privacy Policy</h1>
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          Template notice for the operator: this page describes how the app as built behaves. Have it reviewed against the laws that apply to
          you (for example India&apos;s DPDP Act) and add your legal entity and contact details before launch.
        </p>
        <h2 className="text-xl font-semibold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Account:</strong> name, email and/or mobile number, and a hashed password if you use one.</li>
          <li><strong>Profile:</strong> date of birth, height, weight, optional target weight, optional sex (used only in the calorie equation), activity level, goal, diet preference, allergies, budget and cooking facilities.</li>
          <li><strong>Health notes (optional):</strong> whether you are pregnant or breastfeeding, have a medical condition, or have a history of an eating disorder. We use these only to withhold calorie targets. They are never sent to an AI service.</li>
          <li><strong>Food logs:</strong> the foods, quantities and nutrition values you save, and the original text or transcript you entered.</li>
          <li><strong>Photos:</strong> food photos you choose to upload.</li>
        </ul>
        <h2 className="text-xl font-semibold">AI processing</h2>
        <p>
          When you ask {APP_NAME} to analyse a meal, the text you typed, your voice transcript, or your resized food photo is sent to a third-party AI provider
          chosen by the operator of this app, to identify foods and estimate nutrition. We send only what is needed for that request, not your name, email, profile or health notes.
          Your browser, not our server, converts speech to text; depending on your browser, that speech service may be run by the browser vendor.
          Results are estimates and may be wrong. You review and can edit them before anything is saved.
        </p>
        <h2 className="text-xl font-semibold">Photos and retention</h2>
        <p>
          Photos are stored in a private bucket that only you can read, through short-lived links. You can turn off photo storage in settings, in which case photos are analysed and discarded.
          Deleting a meal deletes its photo. Your data is kept until you delete it or delete your account.
        </p>
        <h2 className="text-xl font-semibold">Your controls</h2>
        <p>
          You can edit or delete any log, change your profile, and permanently delete your account from <Link className="underline" href="/profile">Profile &amp; settings</Link>.
          Deleting your account removes your profile, logs, weights, settings and photos immediately.
        </p>
        <h2 className="text-xl font-semibold">Service providers</h2>
        <p>The app uses Supabase (database, sign-in, file storage), Vercel (hosting) and an AI provider. These process data on our behalf.</p>
        <h2 className="text-xl font-semibold">Not medical advice</h2>
        <p>{APP_NAME} gives general nutrition estimates only. It does not diagnose, treat or prevent any condition.</p>
      </article>
    </main>
  );
}
