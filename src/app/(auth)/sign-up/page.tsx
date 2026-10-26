import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to start. You'll set up your profile in the next step."
      footer={<>Already have an account? <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">Sign in</Link></>}
    >
      <SignUpForm />
    </AuthShell>
  );
}
