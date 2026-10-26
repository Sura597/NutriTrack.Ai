"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError, normalizePhone } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SignUpForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [phoneSent, setPhoneSent] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState("");

  const meta = { full_name: name.trim(), terms_accepted: true };

  function precheck(): boolean {
    setError(null);
    if (!name.trim()) return setError("Please enter your name."), false;
    if (!consent) return setError("Please accept the Privacy Policy and Terms to continue."), false;
    return true;
  }

  function signUpEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!precheck()) return;
    if (password.length < 8) return setError("Choose a password with at least 8 characters.");
    start(async () => {
      const { data, error } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: { data: meta, emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` },
      });
      if (error) return setError(friendlyAuthError(error.message));
      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
      } else {
        // Email confirmation is enabled in Supabase: the user must verify before signing in.
        setConfirmEmail(email.trim());
      }
    });
  }

  function sendPhoneCode(e: React.FormEvent) {
    e.preventDefault();
    if (!precheck()) return;
    const normalized = normalizePhone(phone);
    if (!normalized) return setError("Enter a valid mobile number, e.g. 98765 43210.");
    start(async () => {
      const { error } = await createClient().auth.signInWithOtp({ phone: normalized, options: { shouldCreateUser: true, data: meta } });
      if (error) return setError(friendlyAuthError(error.message));
      setPhoneSent(normalized);
    });
  }

  function verifyPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phoneSent) return;
    start(async () => {
      const { error } = await createClient().auth.verifyOtp({ phone: phoneSent, token: phoneCode.trim(), type: "sms" });
      if (error) return setError(friendlyAuthError(error.message));
      router.replace("/onboarding");
      router.refresh();
    });
  }

  if (confirmEmail) {
    return (
      <Notice tone="success" title="Check your email">
        We sent a confirmation link to <strong>{confirmEmail}</strong>. Open it to verify your account, and you&apos;ll be taken to set up your profile.
        If nothing arrives in a few minutes, check spam or <Link className="underline" href="/sign-in">try signing in</Link>.
      </Notice>
    );
  }

  const shared = (
    <>
      <Field id="su-name" label="Full name">
        <Input id="su-name" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
    </>
  );

  const consentBox = (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
      <span>
        I agree to the <Link href="/privacy" target="_blank" className="text-primary underline">Privacy Policy</Link> and{" "}
        <Link href="/terms" target="_blank" className="text-primary underline">Terms</Link>, including that food text and photos
        may be sent to an AI service for analysis.
      </span>
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice tone="error">{error}</Notice>}
      <Tabs defaultValue="email" onValueChange={() => setError(null)}>
        <TabsList aria-label="Sign-up method">
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="phone">Mobile</TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <form onSubmit={signUpEmail} className="flex flex-col gap-4">
            {shared}
            <Field id="su-email" label="Email">
              <Input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field id="su-password" label="Password" hint="At least 8 characters.">
              <Input id="su-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {consentBox}
            <Button type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</Button>
          </form>
        </TabsContent>

        <TabsContent value="phone">
          {!phoneSent ? (
            <form onSubmit={sendPhoneCode} className="flex flex-col gap-4">
              {shared}
              <Field id="su-phone" label="Mobile number" hint="We'll text a verification code. Requires SMS to be enabled on this server.">
                <Input id="su-phone" type="tel" autoComplete="tel" required placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              {consentBox}
              <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Text me a code"}</Button>
            </form>
          ) : (
            <form onSubmit={verifyPhone} className="flex flex-col gap-4">
              <Notice tone="success">We texted a code to {phoneSent}.</Notice>
              <Field id="su-code" label="Verification code">
                <Input id="su-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,8}" required value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} />
              </Field>
              <Button type="submit" disabled={pending}>{pending ? "Checking…" : "Verify and continue"}</Button>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
