import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/data/session";
import { daySummary } from "@/lib/data/logs";
import { isDateString, todayIn } from "@/lib/dates";
import { MEAL_TYPES, groupByMeal } from "@/lib/nutrition/aggregate";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { MicronutrientsCard } from "@/components/dashboard/micronutrients-card";
import { LogCard } from "@/components/dashboard/log-card";
import { DateNav } from "@/components/dashboard/date-nav";
import { WaterCard } from "@/components/dashboard/water-card";
import { waterForDay } from "@/lib/water/summary";
import { LogFoodButton } from "@/components/dashboard/log-food-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Dashboard" };

const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" } as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { supabase, user, profile, settings } = await requireOnboardedUser();
  const sp = await searchParams;
  const tz = settings.time_zone;
  const today = todayIn(tz);
  const date = sp.date && isDateString(sp.date) && sp.date <= today ? sp.date : today;

  const { logs, summary } = await daySummary(supabase, user.id, tz, date);
  const byMeal = groupByMeal(logs);
  const water = await waterForDay(supabase, tz, date);
  const firstName = (profile.display_name ?? "").split(" ")[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{date === today && firstName ? `Hi ${firstName}` : "Your day"}</h1>
          <p className="text-sm text-muted-foreground">Estimates from what you&apos;ve logged.</p>
        </div>
        <div className="flex items-center gap-3">
          <DateNav date={date} today={today} />
          <LogFoodButton date={date} className="hidden md:inline-flex" />
        </div>
      </div>

      {summary.targets?.calories_kcal == null && (
        <Notice tone="info" title="Targets">
          We haven&apos;t set daily targets for you. This can happen when your profile has health notes that call for professional advice, or when details are missing.
        </Notice>
      )}

      <SummaryCard summary={summary} />

      <div className="grid gap-4 md:grid-cols-2">
        {MEAL_TYPES.map((m) => {
          const group = byMeal[m];
          return (
            <Card key={m}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{MEAL_LABEL[m]}</CardTitle>
                <span className="text-sm tabular-nums text-muted-foreground">{group.totals.calories_kcal} kcal</span>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {group.logs.length === 0 ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-5">
                    <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
                    <LogFoodButton date={date} mealType={m} label={`Add ${MEAL_LABEL[m].toLowerCase()}`} variant="soft" size="sm" />
                  </div>
                ) : (
                  <>
                    {group.logs.map((l) => <LogCard key={l.id} log={l} date={date} showTime timeZone={tz} />)}
                    <LogFoodButton date={date} mealType={m} label="Add more" variant="ghost" size="sm" className="self-start" />
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <WaterCard entries={water.entries} totalMl={water.total_ml} goalMl={profile.water_goal_ml} isToday={date === today} date={date} timeZone={tz} />

      <Link href="/plan" className="flex items-center justify-between rounded-[var(--radius-card)] border border-border bg-card px-5 py-4 text-sm font-medium hover:bg-muted">
        <span>See a simple diet plan for your calorie target</span>
        <span aria-hidden>→</span>
      </Link>

      <MicronutrientsCard summary={summary} />
    </div>
  );
}
