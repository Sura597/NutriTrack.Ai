"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) return setError(friendlyAuthError(error.message));
      setSent(true);
    });
  }

  if (sent)
    return (
      <Notice tone="success" title="Check your email">
        If an account exists for <strong>{email}</strong>, we sent a link to reset your password.
      </Notice>
    );
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Notice tone="error">{error}</Notice>}
      <Field id="fp-email" label="Email">
        <Input id="fp-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Choose a password with at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    start(async () => {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) return setError(friendlyAuthError(error.message));
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Notice tone="error">{error}</Notice>}
      <Field id="rp-pw" label="New password" hint="At least 8 characters.">
        <Input id="rp-pw" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field id="rp-confirm" label="Confirm new password">
        <Input id="rp-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Update password"}</Button>
    </form>
  );
}
