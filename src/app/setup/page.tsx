import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { AuthShell } from "@/components/auth/auth-shell";
import { Notice } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");
  return (
    <AuthShell title="Almost there: connect Supabase" subtitle="This app needs a Supabase project for sign-in and data.">
      <div className="flex flex-col gap-3 text-sm">
        <Notice tone="warn">Supabase isn&apos;t configured yet, so sign-in and saving are switched off.</Notice>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Create a free project at supabase.com.</li>
          <li>Copy <code>.env.example</code> to <code>.env.local</code> and fill in the project URL and anon key.</li>
          <li>Apply the SQL files in <code>supabase/migrations</code>.</li>
          <li>Restart the dev server.</li>
        </ol>
        <p className="text-muted-foreground">The README has the full walkthrough, including phone sign-in and AI setup.</p>
      </div>
    </AuthShell>
  );
}
