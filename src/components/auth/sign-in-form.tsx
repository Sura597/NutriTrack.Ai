"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError, normalizePhone, safeNextPath } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SignInForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter();
  const target = safeNextPath(next);
  const [error, setError] = useState<string | null>(
    initialError === "link_invalid" ? "That sign-in link is invalid or has expired. Request a new one." : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // email code
  const [codeEmail, setCodeEmail] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  // phone
  const [phone, setPhone] = useState("");
  const [phoneSent, setPhoneSent] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState("");

  const reset = () => {
    setError(null);
    setInfo(null);
  };
  const done = () => {
    router.replace(target);
    router.refresh();
  };

  function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    reset();
    start(async () => {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) return setError(friendlyAuthError(error.message));
      done();
    });
  }

  function sendEmailCode(e: React.FormEvent) {
    e.preventDefault();
    reset();
    start(async () => {
      const { error } = await createClient().auth.signInWithOtp({
        email: codeEmail.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
        },
      });
      if (error) return setError(friendlyAuthError(error.message));
      setEmailCodeSent(true);
      setInfo("We sent a code and a sign-in link to your email. Enter the code below or open the link.");
    });
  }

  function verifyEmailCode(e: React.FormEvent) {
    e.preventDefault();
    reset();
    start(async () => {
      const { error } = await createClient().auth.verifyOtp({ email: codeEmail.trim(), token: emailCode.trim(), type: "email" });
      if (error) return setError(friendlyAuthError(error.message));
      done();
    });
  }

  function sendPhoneCode(e: React.FormEvent) {
    e.preventDefault();
    reset();
    const normalized = normalizePhone(phone);
    if (!normalized) return setError("Enter a valid mobile number, e.g. 98765 43210 or +91 98765 43210.");
    start(async () => {
      const { error } = await createClient().auth.signInWithOtp({ phone: normalized, options: { shouldCreateUser: false } });
      if (error) return setError(friendlyAuthError(error.message));
      setPhoneSent(normalized);
      setInfo(`We texted a code to ${normalized}.`);
    });
  }

  function verifyPhoneCode(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (!phoneSent) return;
    start(async () => {
      const { error } = await createClient().auth.verifyOtp({ phone: phoneSent, token: phoneCode.trim(), type: "sms" });
      if (error) return setError(friendlyAuthError(error.message));
      done();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Notice tone="error">{error}</Notice>}
      {info && <Notice tone="success">{info}</Notice>}
      <Tabs defaultValue="password" onValueChange={reset}>
        <TabsList aria-label="Sign-in method">
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="email-code">Email code</TabsTrigger>
          <TabsTrigger value="phone">Mobile</TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <form onSubmit={signInWithPassword} className="flex flex-col gap-4">
            <Field id="si-email" label="Email">
              <Input id="si-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field id="si-password" label="Password">
              <Input id="si-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
            <Link href="/forgot-password" className="text-center text-sm text-primary underline-offset-4 hover:underline">
              Forgot your password?
            </Link>
          </form>
        </TabsContent>

        <TabsContent value="email-code">
          {!emailCodeSent ? (
            <form onSubmit={sendEmailCode} className="flex flex-col gap-4">
              <Field id="ec-email" label="Email" hint="We'll email you a one-time code and sign-in link. No password needed.">
                <Input id="ec-email" type="email" autoComplete="email" required value={codeEmail} onChange={(e) => setCodeEmail(e.target.value)} />
              </Field>
              <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Email me a code"}</Button>
            </form>
          ) : (
            <form onSubmit={verifyEmailCode} className="flex flex-col gap-4">
              <Field id="ec-code" label="Code from your email">
                <Input id="ec-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" required value={emailCode} onChange={(e) => setEmailCode(e.target.value)} />
              </Field>
              <Button type="submit" disabled={pending}>{pending ? "Checking…" : "Verify and sign in"}</Button>
              <Button type="button" variant="ghost" onClick={() => { setEmailCodeSent(false); setEmailCode(""); reset(); }}>Use a different email</Button>
            </form>
          )}
        </TabsContent>

        <TabsContent value="phone">
          {!phoneSent ? (
            <form onSubmit={sendPhoneCode} className="flex flex-col gap-4">
              <Field id="ph-number" label="Mobile number" hint="Indian numbers work without +91. Requires SMS to be enabled on this server.">
                <Input id="ph-number" type="tel" autoComplete="tel" required placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Text me a code"}</Button>
            </form>
          ) : (
            <form onSubmit={verifyPhoneCode} className="flex flex-col gap-4">
              <Field id="ph-code" label="Code from your SMS">
                <Input id="ph-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,8}" required value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} />
              </Field>
              <Button type="submit" disabled={pending}>{pending ? "Checking…" : "Verify and sign in"}</Button>
              <Button type="button" variant="ghost" onClick={() => { setPhoneSent(null); setPhoneCode(""); reset(); }}>Use a different number</Button>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
