"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/alert-dialog";

export function AccountSection() {
  const router = useRouter();
  const [typed, setTyped] = useState("");

  async function deleteAccount() {
    const res = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      toast.error(j?.error?.message ?? "Couldn't delete your account.");
      return;
    }
    toast.success("Your account and data were deleted.");
    router.replace("/");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Sign out, or permanently delete your account along with all food logs, photos, weights and settings.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
          <p className="text-sm font-medium text-red-900">Delete account</p>
          <p className="mt-1 text-sm text-red-900/80">This can&apos;t be undone. Type DELETE to enable the button.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field id="del-confirm" label="Type DELETE" className="sm:w-48">
              <Input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </Field>
            <ConfirmDialog
              trigger={<Button type="button" variant="destructive" disabled={typed !== "DELETE"}>Delete my account</Button>}
              title="Delete your account?"
              description="Everything linked to your account will be erased immediately, including your photos. This cannot be undone."
              confirmLabel="Yes, delete everything"
              onConfirm={deleteAccount}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
