import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { requireOnboardedUser } from "@/lib/data/session";
import { PLAN_DISCLAIMER, buildPlanForUser } from "@/lib/diet-plan/build";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";
import { buttonVariants } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Diet Plan" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { supabase, user, profile } = await requireOnboardedUser();
  const sp = await searchParams;
  const variant = Math.min(Math.max(Number.parseInt(sp.v ?? "0", 10) || 0, 0), 1000);
  const { plan, withheld } = await buildPlanForUser(supabase, user.id, variant);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Your diet plan</h1>
          <p className="text-sm text-muted-foreground">A simple example day for your {profile.dietary_preference.replace("_", "-")} diet.</p>
        </div>
        {plan && (
          <Link href={`/plan?v=${variant + 1}`} className={cn(buttonVariants({ variant: "outline" }))}>
            <RefreshCw /> Show another plan
          </Link>
        )}
      </div>

      <Notice tone="warn" title="General guidance only">{PLAN_DISCLAIMER}</Notice>

      {withheld === "no_target" && (
        <Notice tone="info" title="No plan yet">
          We haven&apos;t set a daily calorie target for you, so we can&apos;t build a plan. This happens when your profile has health notes that call for professional advice, or when details are missing.
          <span className="mt-2 block"><Link href="/profile" className="font-medium underline">Review your profile</Link></span>
        </Notice>
      )}

      {plan && (
        <>
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-4">
              <Stat label="Plan total" value={`${plan.totals.calories_kcal} kcal`} note={`target ${Math.round(plan.target_kcal)}`} />
              <Stat label="Protein" value={`${Math.round(plan.totals.protein_g)} g`} note={plan.target_protein_g ? `target ${Math.round(plan.target_protein_g)} g` : undefined} />
              <Stat label="Carbs / Fat" value={`${Math.round(plan.totals.carbs_g)} / ${Math.round(plan.totals.fat_g)} g`} />
              <Stat label="Estimated cost" value={`~${formatINR(plan.est_cost_inr)}`} note={profile.daily_budget_inr ? `budget ${formatINR(profile.daily_budget_inr)}` : "rough estimate"} />
            </CardContent>
          </Card>

          {plan.notes.map((n) => (
            <Notice key={n} tone="info">{n}</Notice>
          ))}

          <div className="grid gap-4 md:grid-cols-2">
            {plan.slots.map((slot) => (
              <Card key={slot.meal_type}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>{slot.label}</CardTitle>
                  <span className="text-sm tabular-nums text-muted-foreground">{slot.totals.calories_kcal} kcal</span>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border text-sm">
                    {slot.items.map((i) => (
                      <li key={i.food_id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                        <div>
                          <p className="font-medium">{i.food_name}</p>
                          <p className="text-xs text-muted-foreground">{i.quantity} {i.unit}{i.cost_inr !== null ? ` · ~${formatINR(i.cost_inr, i.cost_inr < 10)}` : ""}</p>
                        </div>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{i.calories_kcal} kcal · {i.protein_g} g P</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Portions come from our food table and are estimates. Costs are rough and use your price adjustment. You can log any of these from the Log Food button on your dashboard.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
