import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, Mic, PencilLine, PiggyBank, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/auth/auth-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const features = [
  { icon: Camera, title: "Snap it", text: "Photograph your thali and get a first estimate you can correct." },
  { icon: PencilLine, title: "Type it", text: "\"2 rotis, 1 bowl dal, rice\" is all it takes." },
  { icon: Mic, title: "Say it", text: "Speak your meal and review the transcript before saving." },
  { icon: TrendingUp, title: "See your day", text: "Calories and macros against targets made for you." },
  { icon: PiggyBank, title: "Eat well for less", text: "Affordable Indian foods that fill your protein gap." },
  { icon: ShieldCheck, title: "Private by design", text: "Your logs and photos are visible only to you." },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseConfigured()) redirect("/setup");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link href="/sign-in">Sign in</Link></Button>
          <Button asChild><Link href="/sign-up">Get started</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <section className="py-12 text-center sm:py-20">
          <h1 className="mx-auto max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Know what you eat. Understand what your body needs.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Track meals by photo, text or voice, and discover affordable ways to eat better with everyday Indian food.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link href="/sign-up">Start tracking free</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/sign-in">I have an account</Link></Button>
          </div>
          <p className="mx-auto mt-6 max-w-md text-xs text-muted-foreground">
            Estimates, not exact measurements. This app doesn&apos;t give medical advice or diagnose conditions.
          </p>
        </section>
        <section aria-label="Features" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5">
              <f.icon className="size-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <Link className="underline" href="/privacy">Privacy</Link> · <Link className="underline" href="/terms">Terms</Link>
      </footer>
    </div>
  );
}
