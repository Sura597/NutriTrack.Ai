import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/data/session";
import { loadInsights } from "@/lib/insights/load";
import { TrendChart } from "@/components/insights/trend-chart";
import { WeightPanel } from "@/components/insights/weight-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import type { InsightRange } from "@/lib/insights/stats";

export const metadata: Metadata = { title: "Insights" };

const RANGES: { id: InsightRange; label: string }[] = [
  { id: "day", label: "Today" },
  { id: "week", label: "7 days" },
  { id: "month", label: "30 days" },
];
const MEAL_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { supabase, user, settings } = await requireOnboardedUser();
  const sp = await searchParams;
  const range: InsightRange = sp.range === "day" || sp.range === "month" ? sp.range : "week";
  const ins = await loadInsights(supabase, user.id, settings.time_zone, range);
  const { stats } = ins;
  const mealTotal = ins.meal_split.reduce((a, m) => a + m.calories_kcal, 0);

  const tiles: { label: string; value: string; note?: string }[] = [
    { label: "Days logged", value: `${stats.days_logged} of ${stats.days_in_range}` },
    { label: "Average calories", value: stats.avg_calories_kcal === null ? "–" : `${Math.round(stats.avg_calories_kcal)} kcal`, note: "per logged day" },
    { label: "Average protein", value: stats.avg_protein_g === null ? "–" : `${Math.round(stats.avg_protein_g)} g`, note: "per logged day" },
    {
      label: "Protein target met",
      value: stats.protein_target_days === null ? "–" : `${stats.protein_target_days} of ${stats.days_logged} days`,
      note: "reached 90% or more",
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Insights</h1>
          <p className="text-sm text-muted-foreground">Based on estimates from what you logged. Days you didn&apos;t log are left out, not counted as zero.</p>
        </div>
        <nav aria-label="Time range" className="flex gap-1 rounded-xl bg-muted p-1">
          {RANGES.map((r) => (
            <Link
              key={r.id}
              href={`/insights?range=${r.id}`}
              aria-current={r.id === range ? "page" : undefined}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", r.id === range ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      {stats.days_logged === 0 && <Notice tone="info">Nothing logged in this period yet. Log a meal and your trends will show up here.</Notice>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{t.label}</p>
              <p className="text-lg font-semibold tabular-nums">{t.value}</p>
              {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {range !== "day" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendChart title="Calories" metric="calories_kcal" unit="kcal" color="var(--primary)" target={ins.targets?.calories_kcal ?? null} series={ins.series} />
          <TrendChart title="Protein" metric="protein_g" unit="g" color="var(--protein)" target={ins.targets?.protein_g ?? null} series={ins.series} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Most logged foods</CardTitle></CardHeader>
          <CardContent>
            {ins.top_foods.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ol className="divide-y divide-border text-sm">
                {ins.top_foods.map((f) => (
                  <li key={f.food_name} className="flex justify-between py-1.5">
                    <span>{f.food_name}</span>
                    <span className="tabular-nums text-muted-foreground">{f.times}× · {Math.round(f.avg_kcal)} kcal avg</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Calories by meal</CardTitle></CardHeader>
          <CardContent>
            {mealTotal === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {["breakfast", "lunch", "dinner", "snack"].map((m) => {
                  const kcal = ins.meal_split.find((x) => x.meal_type === m)?.calories_kcal ?? 0;
                  const pct = Math.round((kcal / mealTotal) * 100);
                  return (
                    <li key={m}>
                      <div className="mb-1 flex justify-between"><span>{MEAL_LABEL[m]}</span><span className="tabular-nums text-muted-foreground">{Math.round(kcal)} kcal · {pct}%</span></div>
                      <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <WeightPanel />
    </div>
  );
}
