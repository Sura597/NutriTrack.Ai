import type { Metadata } from "next";
import { Logo } from "@/components/auth/auth-shell";
import { APP_NAME } from "@/lib/format";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Logo />
      <article className="mt-6 space-y-4 text-[15px] leading-relaxed">
        <h1 className="text-3xl font-semibold">Terms of Use</h1>
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          Template for the operator: review with a lawyer and add your legal entity, governing law and contact details before launch.
        </p>
        <h2 className="text-xl font-semibold">Estimates, not advice</h2>
        <p>
          {APP_NAME} provides estimated calories and nutrients from foods, portions and AI analysis. Values can be wrong, especially for photos and mixed dishes.
          It is not medical or dietary advice. If you are pregnant, breastfeeding, under 18, have a medical condition, or have had an eating disorder, please talk to a doctor or registered dietitian.
        </p>
        <h2 className="text-xl font-semibold">Your use</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>You are responsible for the information you enter and the choices you make.</li>
          <li>Don&apos;t upload photos of other people or content you don&apos;t have the right to share.</li>
          <li>Don&apos;t misuse the service, attempt to access other users&apos; data, or overload the AI features. Limits apply.</li>
        </ul>
        <h2 className="text-xl font-semibold">Availability</h2>
        <p>The service is provided as is and may change or be unavailable at times.</p>
      </article>
    </main>
  );
}
