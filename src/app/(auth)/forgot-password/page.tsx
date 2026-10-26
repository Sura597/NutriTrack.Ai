import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={<Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">Back to sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
