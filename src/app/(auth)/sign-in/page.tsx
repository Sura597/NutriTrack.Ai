import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see today's meals and progress."
      footer={<>New here? <Link href="/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">Create an account</Link></>}
    >
      <SignInForm next={sp.next} initialError={sp.error} />
    </AuthShell>
  );
}
